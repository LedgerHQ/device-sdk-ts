"""
Tests of the metadata-service re-signing proxy (`/api/dynamic-descriptor-proxy`).

Run from apps/sample, with the API requirements installed:

    python3 -m unittest discover -s api

The fixtures are metadata-service responses captured on 2026-11-25.
"""

import hashlib
import json
import os
import unittest
from typing import Any, Optional, Tuple
from unittest import mock

import ecdsa
import requests
from ecdsa.util import sigdecode_der

import index

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")

# Prod public keys from CAL `/certificates` on 2026-11-25. Each fixture's prod
# signature verifies with one of them once the locator has found it.
PROD_DOMAIN_METADATA_KEY = "036a94e7a42cd0c33fdf440c8e2ab2542cefbe5db7aa0b93a9fc814b9acfa75eb4"
PROD_PLUGIN_SELECTOR_KEY = "03d8626e019e553e196956f1174dcdb89a1cdac4939008bc7977336d7824eee3a2"
# nft_metadata_key: its `les_multisig` usage is the same HSM key as domain_metadata_key
PROD_NFT_METADATA_KEY_LES_MULTISIG = PROD_DOMAIN_METADATA_KEY
PROD_NFT_METADATA_KEY_NFT_META = "03988da6b246f28e77c1bab675cb2a2744f7f5cec56ae6e03223337b5794cd6ae0"

# Responses with a hex `signedDescriptor` checked under domain_metadata_key,
# with the metadata-service path they answer
SIGNED_DESCRIPTOR_FIXTURES = {
    "solana_alt_resolution.json": "v2/solana/alt-resolution/2RktvdYAyDXXxZ25p94RtHz8dCPRcCHBUqzZXG8EL3Y2/0",
    "solana_token_account_state.json": "v2/solana/token-account-state/2fEYPArTb3s8qq14gx3WuM9eQ1nJzK1EG6jVzyxFxJg6",
    "solana_owner.json": "v2/solana/owner/2fEYPArTb3s8qq14gx3WuM9eQ1nJzK1EG6jVzyxFxJg6",
    "solana_computed_token_account.json": (
        "v2/solana/computed-token-account/8dzfFpL3fBFch2fPUSFufamU7FpFv2p4Ef11W5WbU5iq/"
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    ),
    "ethereum_safe_proxy.json": "v3/ethereum/1/contract/proxy/0xc1897a9acbdd54028da5f7b76b5833a91553aaf6",
}
# POST route: the response names its keyId, so no route table entry is needed
PROXY_DELEGATE_FIXTURE = "ethereum_proxy_delegate.json"
PROXY_DELEGATE_PATH = "v2/ethereum/1/contract/proxy/delegate"
PROXY_DELEGATE_BODY = (
    b'{"proxy":"0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2","data":"0xa9059cbb","challenge":"0x12345678"}'
)
ENS_NAME_FIXTURE = "ethereum_ens_name.json"
ENS_NAME_PATH = "v2/names/ethereum/1/forward/vitalik.eth"
NFT_PLUGIN_SELECTOR_FIXTURE = "ethereum_nft_plugin_selector.json"
NFT_PLUGIN_SELECTOR_PATH = (
    "v1/ethereum/1/contracts/0x8a90cab2b38dba80c64b7734e58ee1db38b8992e/plugin-selector/0x42842e0e"
)
# Responses checked under keys that aren't replaced, or that already carry a staging signature
PASS_THROUGH_FIXTURES = {
    "ethereum_safe_account.json": "v2/ethereum/1/safe/account/0x23f8abfc2824c397ccb3da89ae772984107ddb99",
    "ethereum_nft_info.json": "v1/ethereum/1/contracts/0x8a90cab2b38dba80c64b7734e58ee1db38b8992e",
    "solana_name_usdc.json": "v2/names/solana/mainnet/reverse/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "solana_name_jupiter.json": "v2/names/solana/mainnet/reverse/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
}


def load_fixture_bytes(name: str) -> bytes:
    with open(os.path.join(FIXTURES_DIR, name), "rb") as fixture:
        return fixture.read()


def load_fixture(name: str) -> Any:
    return json.loads(load_fixture_bytes(name))


def decode_hex(value: str) -> bytes:
    return bytes.fromhex(value[2:] if value.startswith("0x") else value)


def verifies(public_key: str, message: bytes, signature: bytes) -> bool:
    key = ecdsa.VerifyingKey.from_string(bytes.fromhex(public_key), curve=ecdsa.SECP256k1)
    try:
        return key.verify(signature, message, hashfunc=hashlib.sha256, sigdecode=sigdecode_der)
    except ecdsa.BadSignatureError:
        return False


def split_signature_tlv(value: str) -> Tuple[bytes, bytes]:
    """Split a TLV descriptor into the signed bytes and its signature."""
    data = decode_hex(value)
    offset = index.find_trailing_signature_tlv(data)
    return data[:offset], data[offset + 2:]


def split_legacy_signature(value: str) -> Tuple[bytes, bytes]:
    """Split a legacy payload into the signed bytes and its signature."""
    data = decode_hex(value)
    offset = index.find_legacy_signature_length(data)
    return data[:offset], data[offset + 1:]


def upstream_response(body: bytes, status: int = 200, content_type: str = "application/json") -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response._content = body
    response.headers["Content-Type"] = content_type
    return response


class ResignAssertions(unittest.TestCase):
    def assert_resigned_tlv(self, original: str, resigned: str) -> None:
        """
        Check that `resigned` keeps the `0x` prefix and the bytes of `original`
        up to its signature, followed by a SIGNATURE field that verifies with
        the CAL interceptor key.
        """
        self.assertEqual(resigned.startswith("0x"), original.startswith("0x"))
        payload, _ = split_signature_tlv(original)
        data = decode_hex(resigned)
        self.assertEqual(data[:len(payload)], payload)
        self.assertEqual(data[len(payload)], index.SIGNATURE_TLV_TAG)
        self.assertEqual(data[len(payload) + 1], len(data) - len(payload) - 2)
        self.assertTrue(verifies(index.TEST_VERIFYING_KEY, payload, data[len(payload) + 2:]))

    def assert_resigned_legacy_payload(self, original: str, resigned: str) -> None:
        """
        Check that `resigned` keeps the signed bytes of `original`, followed by
        the new signature's length and a signature that verifies with the CAL
        interceptor key.
        """
        signed, _ = split_legacy_signature(original)
        data = decode_hex(resigned)
        self.assertEqual(data[:len(signed)], signed)
        self.assertEqual(data[len(signed)], len(data) - len(signed) - 1)
        self.assertTrue(verifies(index.TEST_VERIFYING_KEY, signed, data[len(signed) + 1:]))


class SignatureLocatorTest(unittest.TestCase):
    def test_finds_the_prod_signature_of_each_tlv_descriptor(self) -> None:
        safe_account = load_fixture("ethereum_safe_account.json")
        cases = [
            (name, load_fixture(name)["signedDescriptor"], PROD_DOMAIN_METADATA_KEY)
            for name in SIGNED_DESCRIPTOR_FIXTURES
        ] + [
            (ENS_NAME_FIXTURE, load_fixture(ENS_NAME_FIXTURE)["signedDescriptor"]["data"], PROD_DOMAIN_METADATA_KEY),
            (
                PROXY_DELEGATE_FIXTURE,
                load_fixture(PROXY_DELEGATE_FIXTURE)["signedDescriptor"],
                PROD_DOMAIN_METADATA_KEY,
            ),
            # Multi-byte tags (0x81a0...), which a forward TLV walk can't parse
            (
                "ethereum_safe_account.json accountDescriptor",
                safe_account["accountDescriptor"]["signedDescriptor"],
                PROD_NFT_METADATA_KEY_LES_MULTISIG,
            ),
            (
                "ethereum_safe_account.json signersDescriptor",
                safe_account["signersDescriptor"]["signedDescriptor"],
                PROD_NFT_METADATA_KEY_LES_MULTISIG,
            ),
        ]
        for name, descriptor, prod_key in cases:
            with self.subTest(name):
                payload, signature = split_signature_tlv(descriptor)
                self.assertTrue(verifies(prod_key, payload, signature))

    def test_finds_the_prod_signature_of_each_legacy_payload(self) -> None:
        cases = [
            (NFT_PLUGIN_SELECTOR_FIXTURE, PROD_PLUGIN_SELECTOR_KEY),
            ("ethereum_nft_info.json", PROD_NFT_METADATA_KEY_NFT_META),
        ]
        for name, prod_key in cases:
            with self.subTest(name):
                signed, signature = split_legacy_signature(load_fixture(name)["payload"])
                self.assertTrue(verifies(prod_key, signed, signature))

    def test_rejects_a_descriptor_without_a_trailing_signature(self) -> None:
        unsigned = load_fixture("solana_name_usdc.json")["signedDescriptor"]["data"]
        with self.assertRaises(ValueError):
            index.find_trailing_signature_tlv(bytes.fromhex(unsigned))

    def test_rejects_a_payload_without_a_trailing_signature(self) -> None:
        with self.assertRaises(ValueError):
            index.find_legacy_signature_length(bytes.fromhex("0101064552433732310201"))


class RouteKeyIdTest(unittest.TestCase):
    def test_maps_routes_whose_responses_carry_no_key_id(self) -> None:
        cases = {
            SIGNED_DESCRIPTOR_FIXTURES["solana_owner.json"]: "domain_metadata_key",
            SIGNED_DESCRIPTOR_FIXTURES["solana_computed_token_account.json"]: "domain_metadata_key",
            NFT_PLUGIN_SELECTOR_PATH: "plugin_selector_key",
            f"/{NFT_PLUGIN_SELECTOR_PATH}/": "plugin_selector_key",
        }
        for path, key_id in cases.items():
            with self.subTest(path):
                self.assertEqual(index.route_key_id(path), key_id)

    def test_maps_nothing_else(self) -> None:
        paths = [
            PASS_THROUGH_FIXTURES["ethereum_nft_info.json"],
            PASS_THROUGH_FIXTURES["ethereum_safe_account.json"],
            SIGNED_DESCRIPTOR_FIXTURES["solana_alt_resolution.json"],
            ENS_NAME_PATH,
            "v2/solana/owner/2fEYPArTb3s8qq14gx3WuM9eQ1nJzK1EG6jVzyxFxJg6/extra",
            "v2/concordium/owner/key/address",
        ]
        for path in paths:
            with self.subTest(path):
                self.assertIsNone(index.route_key_id(path))


class ResignDescriptorsInResponseTest(ResignAssertions):
    def test_resigns_hex_signed_descriptors(self) -> None:
        for name, path in SIGNED_DESCRIPTOR_FIXTURES.items():
            with self.subTest(name):
                response = load_fixture(name)

                resigned, count = index.resign_descriptors_in_response(response, index.route_key_id(path))

                self.assertEqual(count, 1)
                self.assert_resigned_tlv(response["signedDescriptor"], resigned["signedDescriptor"])
                self.assertEqual(
                    {key: value for key, value in resigned.items() if key != "signedDescriptor"},
                    {key: value for key, value in response.items() if key != "signedDescriptor"},
                )

    def test_keeps_the_0x_prefix(self) -> None:
        response = load_fixture("ethereum_safe_proxy.json")

        resigned, _ = index.resign_descriptors_in_response(response)

        self.assertTrue(resigned["signedDescriptor"].startswith("0x"))
        self.assertNotEqual(resigned["signedDescriptor"], response["signedDescriptor"])

    def test_resigns_the_embedded_signature_of_an_ens_name(self) -> None:
        response = load_fixture(ENS_NAME_FIXTURE)

        resigned, count = index.resign_descriptors_in_response(response, index.route_key_id(ENS_NAME_PATH))

        self.assertEqual(count, 1)
        self.assert_resigned_tlv(response["signedDescriptor"]["data"], resigned["signedDescriptor"]["data"])
        self.assertEqual(resigned["signedDescriptor"]["signatures"], {})
        self.assertEqual(
            {key: value for key, value in resigned["signedDescriptor"].items() if key != "data"},
            {key: value for key, value in response["signedDescriptor"].items() if key != "data"},
        )

    def test_resigns_the_legacy_payload_of_an_nft_plugin_selector(self) -> None:
        response = load_fixture(NFT_PLUGIN_SELECTOR_FIXTURE)

        resigned, count = index.resign_descriptors_in_response(
            response, index.route_key_id(NFT_PLUGIN_SELECTOR_PATH)
        )

        self.assertEqual(count, 1)
        self.assert_resigned_legacy_payload(response["payload"], resigned["payload"])

    def test_leaves_descriptors_checked_under_other_keys_untouched(self) -> None:
        for name, path in PASS_THROUGH_FIXTURES.items():
            with self.subTest(name):
                response = load_fixture(name)

                resigned, count = index.resign_descriptors_in_response(response, index.route_key_id(path))

                self.assertEqual(count, 0)
                self.assertEqual(resigned, response)

    def test_leaves_a_response_without_key_id_untouched_off_the_route_table(self) -> None:
        response = load_fixture("solana_owner.json")

        resigned, count = index.resign_descriptors_in_response(response)

        self.assertEqual(count, 0)
        self.assertEqual(resigned, response)

    def test_resigns_each_descriptor_of_a_list(self) -> None:
        responses = [load_fixture("solana_alt_resolution.json"), load_fixture("ethereum_safe_account.json")]

        resigned, count = index.resign_descriptors_in_response(responses)

        self.assertEqual(count, 1)
        self.assert_resigned_tlv(responses[0]["signedDescriptor"], resigned[0]["signedDescriptor"])
        self.assertEqual(resigned[1], responses[1])


class DynamicDescriptorProxyTest(ResignAssertions):
    def setUp(self) -> None:
        self.client = index.app.test_client()

    def proxy(
        self, path: str, upstream: Any, method: str = "GET", body: Optional[bytes] = None
    ) -> Tuple[Any, mock.Mock]:
        """
        Send `path` through the proxy, with `upstream` as the metadata service's
        answer or error. A body is sent as JSON.
        """
        side_effect = upstream if isinstance(upstream, Exception) else None
        with mock.patch.object(index.requests, "request", return_value=upstream, side_effect=side_effect) as send:
            response = self.client.open(
                f"/api/dynamic-descriptor-proxy/{path}?challenge=12345678",
                method=method,
                data=body,
                content_type="application/json" if body is not None else None,
            )
        return response, send

    def test_forwards_the_path_and_query_to_the_metadata_service(self) -> None:
        path = SIGNED_DESCRIPTOR_FIXTURES["solana_owner.json"]

        with self.assertLogs(index.app.logger, "INFO"):
            _, send = self.proxy(path, upstream_response(load_fixture_bytes("solana_owner.json")))

        send.assert_called_once_with(
            "GET", f"{index.DEFAULT_METADATA_SERVICE_URL}/{path}", params=mock.ANY, data=None, headers={}, timeout=10
        )
        self.assertEqual(dict(send.call_args.kwargs["params"]), {"challenge": "12345678"})

    def test_forwards_a_post_and_its_body_to_the_metadata_service(self) -> None:
        with self.assertLogs(index.app.logger, "INFO"):
            _, send = self.proxy(
                PROXY_DELEGATE_PATH,
                upstream_response(load_fixture_bytes(PROXY_DELEGATE_FIXTURE)),
                method="POST",
                body=PROXY_DELEGATE_BODY,
            )

        send.assert_called_once_with(
            "POST",
            f"{index.DEFAULT_METADATA_SERVICE_URL}/{PROXY_DELEGATE_PATH}",
            params=mock.ANY,
            data=PROXY_DELEGATE_BODY,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

    def test_serves_a_proxy_delegate_descriptor_resigned(self) -> None:
        fixture = load_fixture_bytes(PROXY_DELEGATE_FIXTURE)
        original = json.loads(fixture)["signedDescriptor"]

        with self.assertLogs(index.app.logger, "INFO") as logs:
            response, _ = self.proxy(
                PROXY_DELEGATE_PATH, upstream_response(fixture), method="POST", body=PROXY_DELEGATE_BODY
            )

        self.assertEqual(response.status_code, 200)
        resigned = response.get_json()["signedDescriptor"]
        self.assert_resigned_tlv(original, resigned)
        self.assertEqual(response.data, fixture.replace(original.encode(), resigned.encode()))
        self.assertIn("Re-signed 1 descriptor(s)", logs.output[0])

    def test_serves_hex_signed_descriptors_resigned(self) -> None:
        for name, path in SIGNED_DESCRIPTOR_FIXTURES.items():
            with self.subTest(name):
                fixture = load_fixture_bytes(name)
                original = json.loads(fixture)["signedDescriptor"]

                with self.assertLogs(index.app.logger, "INFO") as logs:
                    response, _ = self.proxy(path, upstream_response(fixture))

                self.assertEqual(response.status_code, 200)
                resigned = response.get_json()["signedDescriptor"]
                self.assert_resigned_tlv(original, resigned)
                # Only the signature changes, down to the formatting
                self.assertEqual(response.data, fixture.replace(original.encode(), resigned.encode()))
                self.assertIn("Re-signed 1 descriptor(s)", logs.output[0])

    def test_serves_an_ens_name_resigned(self) -> None:
        fixture = load_fixture_bytes(ENS_NAME_FIXTURE)
        original = json.loads(fixture)["signedDescriptor"]["data"]

        with self.assertLogs(index.app.logger, "INFO"):
            response, _ = self.proxy(ENS_NAME_PATH, upstream_response(fixture))

        self.assertEqual(response.status_code, 200)
        resigned = response.get_json()["signedDescriptor"]["data"]
        self.assert_resigned_tlv(original, resigned)
        self.assertEqual(response.data, fixture.replace(original.encode(), resigned.encode()))

    def test_serves_an_nft_plugin_selector_resigned(self) -> None:
        fixture = load_fixture_bytes(NFT_PLUGIN_SELECTOR_FIXTURE)
        original = json.loads(fixture)["payload"]

        with self.assertLogs(index.app.logger, "INFO"):
            response, _ = self.proxy(NFT_PLUGIN_SELECTOR_PATH, upstream_response(fixture))

        self.assertEqual(response.status_code, 200)
        resigned = response.get_json()["payload"]
        self.assert_resigned_legacy_payload(original, resigned)
        self.assertEqual(response.data, fixture.replace(original.encode(), resigned.encode()))

    def test_serves_other_responses_byte_identical(self) -> None:
        for name, path in PASS_THROUGH_FIXTURES.items():
            with self.subTest(name):
                fixture = load_fixture_bytes(name)

                with self.assertLogs(index.app.logger, "INFO") as logs:
                    response, _ = self.proxy(path, upstream_response(fixture))

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, fixture)
                self.assertEqual(response.content_type, "application/json")
                self.assertIn("nothing checked under a replaced key", logs.output[0])

    def test_forwards_error_statuses_and_bodies(self) -> None:
        cases = [
            (404, b'{"status":404,"message":"Not found"}', "application/json"),
            (400, b"Invalid value for: path parameter chainId", "text/plain; charset=UTF-8"),
            (500, b"Internal Server Error", "text/plain"),
        ]
        for status, body, content_type in cases:
            with self.subTest(status):
                with self.assertLogs(index.app.logger, "INFO"):
                    response, _ = self.proxy(
                        SIGNED_DESCRIPTOR_FIXTURES["solana_owner.json"],
                        upstream_response(body, status, content_type),
                    )

                self.assertEqual(response.status_code, status)
                self.assertEqual(response.data, body)
                self.assertEqual(response.content_type, content_type)

    def test_forwards_a_non_json_body(self) -> None:
        with self.assertLogs(index.app.logger, "INFO"):
            response, _ = self.proxy("v1/status", upstream_response(b"OK", 200, "text/plain"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, b"OK")

    def test_answers_502_when_the_metadata_service_is_unreachable(self) -> None:
        response, _ = self.proxy(
            SIGNED_DESCRIPTOR_FIXTURES["solana_owner.json"],
            requests.ConnectionError("unreachable"),
        )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.get_json(), {"error": "Failed to fetch from metadata service."})

    def test_answers_500_when_a_descriptor_cannot_be_resigned(self) -> None:
        body = b'{"signedDescriptor":"0101","keyId":"domain_metadata_key"}'

        response, _ = self.proxy(SIGNED_DESCRIPTOR_FIXTURES["solana_alt_resolution.json"], upstream_response(body))

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.get_json(), {"error": "Failed to re-sign descriptor."})

    def test_only_proxies_get_and_post(self) -> None:
        with mock.patch.object(index.requests, "request") as send:
            response = self.client.put(f"/api/dynamic-descriptor-proxy/{ENS_NAME_PATH}")

        self.assertEqual(response.status_code, 405)
        send.assert_not_called()


class SignerInfoTest(unittest.TestCase):
    # The clear-signing tester refuses a signer below this version
    def test_names_the_resigning_proxy_version(self) -> None:
        response = index.app.test_client().get("/api/signer-info")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"resigningProxyVersion": 2})


if __name__ == "__main__":
    unittest.main()
