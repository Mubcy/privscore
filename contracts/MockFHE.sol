// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice A minimal mock FHE verifier used for local testing.
///         Its checkSignatures function purposely does nothing (does not revert).
///         This lets PrivScore.submitDecryptedScore succeed when testingMode == false.
contract MockFHE {
    // keep same signature shape as IFHE.checkSignatures in your PrivScore
    function checkSignatures(bytes32[] calldata /*handles*/, bytes calldata /*abiEncodedCleartexts*/, bytes calldata /*decryptionProof*/) external pure {
        // intentionally do nothing — accept all
    }
}
