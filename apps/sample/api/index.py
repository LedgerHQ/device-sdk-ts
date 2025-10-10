import hashlib
from typing import Any, Dict, List, Optional, Tuple, Union

import ecdsa
import requests
from ecdsa.util import sigencode_der
from flask import Flask, jsonify, request
from pydantic import ValidationError

from erc7730.convert.calldata.convert_erc7730_input_to_calldata import (
    erc7730_descriptor_to_calldata_descriptors,
)
from erc7730.model.input.descriptor import InputERC7730Descriptor

# Constants
DEFAULT_CAL_URL = "https://crypto-assets-service.api.ledger.com/v1"
TEST_SIGNING_KEY = "b1ed47ef58f782e2bc4d5abe70ef66d9009c2957967017054470e0f3e10f5833"
TEST_VERIFYING_KEY = "0320da62003c0ce097e33644a10fe4c30454069a4454f0fa9d4e84f45091429b52"
TEST_SIGNING_KEY_CERTIFICATE = "f7aeb3d0f44f1bf50d89a1996bbb2bf0544dce2e0a2d0ff67eea0fa9c750f3d0"
# Only override CAL public keys, not metadata service or TX check keys that remain dynamic
CAL_CERTIFICATES_OVERRIDES = {
    "cal_calldata_key",
    "erc20_metadata_key",
    "cal_network",
    "plugin_selector_key",
    "cal_trusted_name"
}

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


def process_descriptor(descriptor: Any) -> Dict[str, Any]:
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

@app.route("/api/process-erc7730-descriptor", methods=["POST"])
def process_erc7730_descriptor() -> Tuple[Dict[str, Any], int]:
    """
    Process an ERC7730 descriptor and return the processed data for client storage
    """
    try:
        request_data = request.get_json()
        if not request_data:
            return {"error": "No JSON data provided"}, 400

        # Validate input descriptor
        input_descriptor = InputERC7730Descriptor.model_validate(
            request_data,
            strict=False
        )

        # Convert to calldata descriptors
        calldata_descriptors = erc7730_descriptor_to_calldata_descriptors(input_descriptor)

        # Check if conversion returned empty list
        if not calldata_descriptors:
            return {"error": "Failed to convert ERC7730 descriptor: no calldata descriptors generated. Please check the descriptor format."}, 400

        # Group descriptors by chain and address
        grouped_descriptors = group_descriptors_by_chain_and_address(calldata_descriptors)

        # Process each group and return them to client
        processed_descriptors = {}
        for (chain_id, address), descriptors in grouped_descriptors.items():
            selectors = {
                descriptor.selector: process_descriptor(descriptor)
                for descriptor in descriptors
            }

            descriptor_data = [{
                "descriptors_calldata": {address: selectors}
            }]

            # Use "chainId:address" format as key for client storage
            key = f"{chain_id}:{address}"
            processed_descriptors[key] = descriptor_data

        return {
            "message": "ERC7730 descriptor processed successfully",
            "descriptors": processed_descriptors
        }, 200

    except ValidationError as e:
        return {"error": f"Invalid descriptor format: {str(e)}"}, 400
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


if __name__ == "__main__":
    app.run(debug=True)
