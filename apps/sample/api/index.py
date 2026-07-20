import hashlib
import os
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import ecdsa
import requests
from ecdsa.util import sigencode_der
from flask import Flask, jsonify, request
from pydantic import ValidationError


from eip712.convert.input_to_resolved import EIP712InputToResolvedConverter
from eip712.convert.resolved_to_instructions import (
    EIP712ResolvedToInstructionsConverter,
)
from eip712.model.input.descriptor import InputEIP712DAppDescriptor
from eip712.model.instruction import EIP712Instruction
from eip712.model.types import EIP712Version
from eip712.serialize import serialize_instruction
from erc7730.convert.calldata.convert_erc7730_input_to_calldata import (
    erc7730_descriptor_to_calldata_descriptors,
)
from erc7730.convert.ledger.eip712.convert_erc7730_to_eip712 import (
    ERC7730toEIP712Converter,
)
from erc7730.convert.ledger.eip712.convert_erc7730_v2_to_eip712 import (
    ERC7730V2toEIP712Converter,
)
from erc7730.convert.resolved.convert_erc7730_input_to_resolved import (
    ERC7730InputToResolved,
)
from erc7730.common.output import ListOutputAdder
from erc7730.model.input.descriptor import InputERC7730Descriptor

# v2 imports
from erc7730.convert.calldata.convert_erc7730_v2_input_to_calldata import (
    erc7730_v2_descriptor_to_calldata_descriptors,
)
from erc7730.model.input.v2.descriptor import InputERC7730Descriptor as InputERC7730DescriptorV2

# Constants
DEFAULT_CAL_URL = "https://global.api.prd.ledger.com/cal/v1"
DEFAULT_METADATA_SERVICE_URL = "https://nft.api.live.ledger.com"
SIGNATURE_TLV_TAG = 0x15
TEST_SIGNING_KEY = "b1ed47ef58f782e2bc4d5abe70ef66d9009c2957967017054470e0f3e10f5833"
TEST_VERIFYING_KEY = "0320da62003c0ce097e33644a10fe4c30454069a4454f0fa9d4e84f45091429b52"
TEST_SIGNING_KEY_CERTIFICATE = "f7aeb3d0f44f1bf50d89a1996bbb2bf0544dce2e0a2d0ff67eea0fa9c750f3d0"
# Only override CAL public keys, not metadata service or TX check keys that remain dynamic
CAL_CERTIFICATES_OVERRIDES = {
    "cal_calldata_key",
    "erc20_metadata_key",
    "cal_network",
    "plugin_selector_key",
    "cal_trusted_name",
    "cal_gated_signing",
    "domain_metadata_key",
    "token_metadata_key"
}

def _is_v2_descriptor(data: Dict[str, Any]) -> bool:
    """Check if the descriptor uses the v2 schema."""
    schema = data.get("$schema") or ""
    return "v2" in schema


# Global state
app = Flask(__name__)


def remove_null_values(obj: Any) -> Any:
    """
    Recursively remove keys with None/null values from dictionaries and lists.
    This is needed to behave the same way as the CAL service.
    """
    if isinstance(obj, dict):
        return {
            key: remove_null_values(value)
            for key, value in obj.items()
            if value is not None
        }
    elif isinstance(obj, list):
        return [
            remove_null_values(item)
            for item in obj
            if item is not None
        ]
    else:
        return obj


def normalize_etherscan_urls(obj: Any) -> Any:
    """
    Recursively process JSON data to update Etherscan URLs:
    1. Replace old API URLs with v2 API URLs
    2. Append API key if ETHERSCAN_API_KEY environment variable is set
    """
    if isinstance(obj, dict):
        return {
            key: normalize_etherscan_urls(value)
            for key, value in obj.items()
        }
    elif isinstance(obj, list):
        return [
            normalize_etherscan_urls(item)
            for item in obj
        ]
    elif isinstance(obj, str):
        # Step 1: Replace old API URL format with v2 format
        if obj.startswith("https://api.etherscan.io/api?module=contract&action=getabi&address="):
            obj = obj.replace(
                "https://api.etherscan.io/api?module=contract&action=getabi&address=",
                "https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getabi&address=",
                1
            )

        # Step 2: Append API key if URL starts with v2 API and ETHERSCAN_API_KEY is set
        if obj.startswith("https://api.etherscan.io/v2/api"):
            api_key = os.getenv("ETHERSCAN_API_KEY")
            if api_key:
                obj = f"{obj}&apikey={api_key}"

        return obj
    else:
        return obj


def sign_payload(payload: str, signing_key: str = TEST_SIGNING_KEY) -> Dict[str, Any]:
    """
    Sign a payload with CAL staging key.
    """
    signing_key_obj = ecdsa.SigningKey.from_string(
        bytes.fromhex(signing_key),
        curve=ecdsa.SECP256k1
    )
    signature = signing_key_obj.sign(
        bytes.fromhex(payload),
        hashfunc=hashlib.sha256,
        sigencode=sigencode_der
    )
    return {"data": payload, "signatures": {"test": signature.hex(), "prod": signature.hex()}}


def sign_enum_descriptors(enums: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Sign enums descriptors and group them the same way as done by the CAL service
    """
    signed_enums: Dict[str, Dict[str, Any]] = {}

    for enum in enums:
        enum_id = enum["id"]
        enum_value = enum["value"]
        enum_descriptor = sign_payload(enum["descriptor"])
        signed_enums.setdefault(enum_id, {})[enum_value] = enum_descriptor

    return signed_enums


def format_and_sign_descriptor(descriptor: Any) -> Dict[str, Any]:
    """
    Process a single descriptor: convert to JSON, sign, and clean.
    """
    json_descriptor = descriptor.model_dump(mode="json")

    # Sign transaction info
    if "transaction_info" in json_descriptor and "descriptor" in json_descriptor["transaction_info"]:
        json_descriptor["transaction_info"]["descriptor"] = sign_payload(
            json_descriptor["transaction_info"]["descriptor"]
        )

    # Sign enums
    if "enums" in json_descriptor:
        json_descriptor["enums"] = sign_enum_descriptors(json_descriptor["enums"])

    return remove_null_values(json_descriptor)


def group_descriptors_by_chain_and_address(
    calldata_descriptors: List[Any]
) -> Dict[Tuple[int, str], List[Any]]:
    """
    Group descriptors by chain ID and contract address.
    """
    grouped: Dict[Tuple[int, str], List[Any]] = {}

    for descriptor in calldata_descriptors:
        key = (descriptor.chain_id, descriptor.address.lower())
        grouped.setdefault(key, []).append(descriptor)

    return grouped


def process_contract_descriptor(input_descriptor: InputERC7730Descriptor) -> Dict[str, Any]:
    """
    Process a contract-type ERC7730 v1 descriptor.
    """
    # Convert to calldata descriptors
    calldata_descriptors = erc7730_descriptor_to_calldata_descriptors(input_descriptor)

    # Check if conversion returned empty list
    if not calldata_descriptors:
        raise ValueError("No calldata descriptors generated. Please check the descriptor format.")

    return _group_and_sign_calldata_descriptors(calldata_descriptors)


def process_contract_descriptor_v2(input_descriptor_v2: InputERC7730DescriptorV2) -> Dict[str, Any]:
    """
    Process a contract-type ERC7730 v2 descriptor.
    """
    calldata_descriptors = erc7730_v2_descriptor_to_calldata_descriptors(input_descriptor_v2)

    if not calldata_descriptors:
        raise ValueError("No calldata descriptors generated from v2 descriptor. Please check the descriptor format.")

    return _group_and_sign_calldata_descriptors(calldata_descriptors)


def _group_and_sign_calldata_descriptors(calldata_descriptors: List[Any]) -> Dict[str, Any]:
    """
    Common logic: group descriptors by chain/address, sign them, and return.
    """
    # Group descriptors by chain and address
    grouped_descriptors = group_descriptors_by_chain_and_address(calldata_descriptors)

    # Process each group and return them to client
    processed_descriptors = {}
    for (chain_id, address), descriptors in grouped_descriptors.items():
        selectors = {
            descriptor.selector: format_and_sign_descriptor(descriptor)
            for descriptor in descriptors
        }

        descriptor_data = [{
            "descriptors_calldata": {address: selectors}
        }]

        # Use "chainId:address" format as key for client storage
        key = f"{chain_id}:{address}"
        processed_descriptors[key] = descriptor_data

    return processed_descriptors


def format_and_sign_eip712_instruction(descriptor: EIP712Instruction) -> Dict[str, Any]:
    """
    Process a single instruction: convert to JSON, sign, and clean.
    """
    json_descriptor = descriptor.model_dump(mode="json")
    if json_descriptor.get("name_types") is not None:
        json_descriptor["name_types"] = [
            EIP712ResolvedToInstructionsConverter.int_to_name_type(value).value
            if isinstance(value, int)
            else value
            for value in json_descriptor["name_types"]
        ]
    if json_descriptor.get("name_sources") is not None:
        json_descriptor["name_sources"] = [
            EIP712ResolvedToInstructionsConverter.int_to_name_source(value).value
            if isinstance(value, int)
            else value
            for value in json_descriptor["name_sources"]
        ]
    serialized = serialize_instruction(descriptor, EIP712Version.V2)
    signature = sign_payload(serialized)
    json_descriptor["descriptor"] = serialized
    json_descriptor["signatures"] = signature["signatures"]
    return remove_null_values(json_descriptor)


def convert_erc7730_to_eip712_descriptor(descriptor: InputEIP712DAppDescriptor) -> Dict[str, Dict[str, Any]]:
    """
    Convert ERC7730 descriptors to EIP712 descriptors.
    Returns a dict keyed by "chain_id:address" strings.
    """
    resolved_descriptor = EIP712InputToResolvedConverter().convert(descriptor)
    instructions = EIP712ResolvedToInstructionsConverter().convert(resolved_descriptor)

    # instructions structure: {address: {schema_hash: [instruction_list]}}
    result = {}
    for (address, instruction_dict) in instructions.items():
        for (schema_hash, instructions_list) in instruction_dict.items():
            if not instructions_list:
                continue

            first_instruction = instructions_list[0]
            chain_id = first_instruction.chain_id

            key = f"{chain_id}:{address}"
            if key not in result:
                result[key] = {}
            if address not in result[key]:
                result[key][address] = {}
            result[key][address][schema_hash] = {
                "instructions": [
                    format_and_sign_eip712_instruction(instruction)
                    for instruction in instructions_list
                ]
            }

    return result


def process_eip712_descriptor(input_descriptor: InputERC7730Descriptor) -> Dict[str, Any]:
    """
    Process an EIP712-type ERC7730 v1 descriptor.
    Converts ERC7730 input to resolved format, then to EIP712 descriptors.
    """
    return _convert_and_format_eip712_descriptors(
        convert_to_eip712=lambda output: _convert_v1_erc7730_to_eip712_descriptors(input_descriptor, output),
        conversion_error_message="Failed to convert ERC7730 descriptor to EIP712",
        empty_error_message="No eip712 descriptors generated. Please check the descriptor format.",
    )


def process_eip712_descriptor_v2(input_descriptor_v2: InputERC7730DescriptorV2) -> Dict[str, Any]:
    """
    Process an EIP712-type ERC7730 v2 descriptor.
    Uses the v2 converter to produce legacy EIP-712 descriptors.
    """
    return _convert_and_format_eip712_descriptors(
        convert_to_eip712=lambda output: _convert_v2_erc7730_to_eip712_descriptors(input_descriptor_v2, output),
        conversion_error_message="Failed to convert v2 ERC7730 descriptor to EIP712",
        empty_error_message="No eip712 descriptors generated from v2 descriptor. Please check the descriptor format.",
    )


def _convert_v1_erc7730_to_eip712_descriptors(
    input_descriptor: InputERC7730Descriptor,
    output: ListOutputAdder,
) -> Optional[Dict[str, InputEIP712DAppDescriptor]]:
    """
    v1 pipeline: input -> resolved -> EIP712 descriptors.
    """
    resolved_descriptor = ERC7730InputToResolved().convert(input_descriptor, output)
    if resolved_descriptor is None:
        raise ValueError(f"Failed to resolve ERC7730 descriptor: {output}")

    return ERC7730toEIP712Converter().convert(resolved_descriptor, output)


def _convert_v2_erc7730_to_eip712_descriptors(
    input_descriptor_v2: InputERC7730DescriptorV2,
    output: ListOutputAdder,
) -> Optional[Dict[str, InputEIP712DAppDescriptor]]:
    """
    v2 pipeline currently relies on the dedicated v2 -> EIP712 converter.
    """
    return ERC7730V2toEIP712Converter().convert(input_descriptor_v2, output)


def _convert_and_format_eip712_descriptors(
    convert_to_eip712: Callable[[ListOutputAdder], Optional[Dict[str, InputEIP712DAppDescriptor]]],
    conversion_error_message: str,
    empty_error_message: str,
) -> Dict[str, Any]:
    """
    Common logic for v1/v2 EIP712 conversion: run converter, validate result and format response.
    """
    output = ListOutputAdder()
    eip712_descriptors = convert_to_eip712(output)

    if eip712_descriptors is None:
        raise ValueError(f"{conversion_error_message}: {output}")
    if not eip712_descriptors:
        raise ValueError(empty_error_message)

    return _format_eip712_descriptors_for_response(eip712_descriptors)


def _format_eip712_descriptors_for_response(
    eip712_descriptors: Dict[str, InputEIP712DAppDescriptor],
) -> Dict[str, Any]:
    """
    Common post-conversion logic for both v1 and v2 EIP712 descriptor flows.
    Organize generated descriptors by chain_id:address for client storage.
    """
    processed_descriptors = {}

    for descriptor_in in eip712_descriptors.values():
        generated_by_chain_address = convert_erc7730_to_eip712_descriptor(descriptor_in)
        for key, generated_data in generated_by_chain_address.items():
            processed_descriptors[key] = [{
                "descriptors_eip712": generated_data
            }]

    return processed_descriptors


@app.route("/api/process-erc7730-descriptor", methods=["POST"])
def process_erc7730_descriptor() -> Tuple[Dict[str, Any], int]:
    """
    Process an ERC7730 descriptor and return the processed data for client storage.
    Supports both contract and EIP712 descriptor types.
    """
    try:
        request_data = request.get_json()
        if not request_data:
            return {"error": "No JSON data provided"}, 400

        # Normalize Etherscan URLs in the request data
        request_data = normalize_etherscan_urls(request_data)

        # Detect v2 schema and dispatch accordingly
        is_v2 = _is_v2_descriptor(request_data)

        if is_v2:
            # v2 descriptor pipeline
            input_descriptor_v2 = InputERC7730DescriptorV2.model_validate(
                request_data,
                strict=False
            )
            context = input_descriptor_v2.context
            if not context:
                return {"error": "Missing context in v2 descriptor"}, 400

            if hasattr(context, 'contract') and context.contract is not None:
                processed_descriptors = process_contract_descriptor_v2(input_descriptor_v2)
            elif hasattr(context, 'eip712') and context.eip712 is not None:
                processed_descriptors = process_eip712_descriptor_v2(input_descriptor_v2)
            else:
                return {"error": "Unknown v2 descriptor type: context must contain either 'contract' or 'eip712'"}, 400
        else:
            # v1 descriptor pipeline
            input_descriptor = InputERC7730Descriptor.model_validate(
                request_data,
                strict=False
            )
            context = input_descriptor.context
            if not context:
                return {"error": "Missing context in descriptor"}, 400

            if hasattr(context, 'contract') and context.contract is not None:
                processed_descriptors = process_contract_descriptor(input_descriptor)
            elif hasattr(context, 'eip712') and context.eip712 is not None:
                processed_descriptors = process_eip712_descriptor(input_descriptor)
            else:
                return {"error": "Unknown descriptor type: context must contain either 'contract' or 'eip712'"}, 400

        return {
            "message": "ERC7730 descriptor processed successfully",
            "descriptors": processed_descriptors
        }, 200

    except ValidationError as e:
        return {"error": f"Invalid descriptor format: {str(e)}"}, 400
    except ValueError as e:
        return {"error": str(e)}, 400
    except Exception as e:
        return {"error": f"Failed to process descriptor: {str(e)}"}, 500


def reformat_certificate(cert: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """
    Reformat and sign a certificate descriptor for speculos.
    """
    target_device = cert.get("target_device", "")
    public_key_id = cert.get("public_key_id", "")
    public_key_usage = cert.get("public_key_usage", "")
    original_public_key = cert.get("public_key", "")

    # Create composite key
    composite_key = f"{target_device}:{public_key_id}:{public_key_usage}"

    # Get descriptor and replace public key in data
    descriptor = cert.get("descriptor", {}).copy()
    if "data" in descriptor and original_public_key:
        # Replace public key in data
        new_data = descriptor["data"].replace(original_public_key, TEST_VERIFYING_KEY)
        descriptor["data"] = new_data

        # Recalculate signature on new data
        signed_descriptor = sign_payload(new_data, TEST_SIGNING_KEY_CERTIFICATE)

        # Update signatures: replace "test" and "prod" with new signature
        descriptor["signatures"] = {
            "test": signed_descriptor["signatures"]["test"],
            "prod": signed_descriptor["signatures"]["test"]
        }

    return composite_key, descriptor


@app.route("/api/certificates", methods=["GET"])
def get_certificates() -> Tuple[Dict[str, Any], int]:
    """
    Fetch certificate descriptors from CAL and return reprocessed descriptors compatible with Speculos.
    """
    try:
        # Fetch certificates from CAL service
        url = f"{DEFAULT_CAL_URL}/certificates"
        params = {
            "ref": "branch:main",
            "output": "public_key,target_device,public_key_id,public_key_usage,descriptor"
        }
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        certificates = response.json()

        if not isinstance(certificates, list):
            return {"error": "Unexpected response format from CAL service"}, 500

        # Filter certificates by allowed public_key_id
        filtered_certificates = [
            cert for cert in certificates
            if cert.get("public_key_id") in CAL_CERTIFICATES_OVERRIDES
        ]

        # Reformat each filtered certificate into a dictionary
        reformatted_certificates = {}
        for cert in filtered_certificates:
            composite_key, descriptor = reformat_certificate(cert)
            reformatted_certificates[composite_key] = [{"descriptor": descriptor}]

        return reformatted_certificates, 200

    except requests.RequestException as e:
        return {"error": f"Failed to fetch certificates: {str(e)}"}, 502
    except Exception as e:
        return {"error": f"Failed to process certificates: {str(e)}"}, 500


def resign_signed_descriptor(signed_descriptor_hex: str) -> str:
    """
    Re-sign a signed TLV descriptor with the CAL interceptor key.

    The descriptor is a sequence of TLV fields (1-byte tag, 1-byte length,
    value) whose last field is a SIGNATURE (tag 0x15) holding a DER-encoded
    ECDSA signature over the SHA-256 of every preceding TLV byte. We walk the
    TLV fields to locate that trailing SIGNATURE, recompute the signature over
    the preceding bytes with TEST_SIGNING_KEY, and splice it back in so a
    Speculos device provisioned with the test certificates accepts it.
    """
    data = bytes.fromhex(signed_descriptor_hex)

    # Walk TLV fields from the start; the SIGNATURE field is always last.
    offset = 0
    signature_offset: Optional[int] = None
    while offset < len(data):
        if offset + 1 >= len(data):
            raise ValueError("truncated TLV: missing length byte")
        tag = data[offset]
        length = data[offset + 1]
        value_end = offset + 2 + length
        if value_end > len(data):
            raise ValueError("truncated TLV: value exceeds descriptor length")
        if tag == SIGNATURE_TLV_TAG:
            signature_offset = offset
        offset = value_end

    if signature_offset is None:
        raise ValueError("no SIGNATURE (tag 0x15) field found in descriptor")

    payload = data[:signature_offset]
    signature = bytes.fromhex(sign_payload(payload.hex())["signatures"]["test"])
    signature_tlv = bytes([SIGNATURE_TLV_TAG, len(signature)]) + signature
    return (payload + signature_tlv).hex()


def resign_descriptors_in_response(obj: Any) -> Any:
    """
    Recursively re-sign every `signedDescriptor` string found in a metadata
    service response. Works for both single-descriptor objects and any
    array/batch shape the service might return.
    """
    if isinstance(obj, dict):
        return {
            key: resign_signed_descriptor(value)
            if key == "signedDescriptor" and isinstance(value, str)
            else resign_descriptors_in_response(value)
            for key, value in obj.items()
        }
    elif isinstance(obj, list):
        return [resign_descriptors_in_response(item) for item in obj]
    else:
        return obj


@app.route("/api/dynamic-descriptor-proxy/<path:subpath>", methods=["GET"])
def dynamic_descriptor_proxy(subpath: str) -> Tuple[Any, int]:
    """
    Proxy dynamic-descriptor metadata-service requests to the real service and
    re-sign every `signedDescriptor` in the response with the CAL interceptor
    key. Dynamic descriptors carry a single prod signature embedded in the TLV
    (trailing SIGNATURE tag), so they must be re-signed for a Speculos test
    device to accept them.

    Fully generic: works for any dynamic-descriptor endpoint (e.g. ALT
    resolution `/v2/solana/alt-resolution/<alt>/<index>`, token account state
    `/v2/solana/token-account-state/<account>`).

    The sample app's CAL interceptor redirects those requests here; the original
    path and query string are forwarded to the upstream metadata service.
    """
    try:
        upstream_url = f"{DEFAULT_METADATA_SERVICE_URL}/{subpath}"
        response = requests.get(upstream_url, params=request.args, timeout=10)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as e:
        return jsonify({"error": f"Failed to fetch from metadata service."}), 502
    except ValueError as e:
        return jsonify({"error": f"Metadata service returned non-JSON response."}), 502

    try:
        resigned = resign_descriptors_in_response(payload)
    except ValueError as e:
        return jsonify({"error": f"Failed to re-sign descriptor."}), 500

    return jsonify(resigned), 200


if __name__ == "__main__":
    app.run(debug=False)
