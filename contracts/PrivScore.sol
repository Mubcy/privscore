// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Minimal Ownable implementation (avoid OpenZeppelin version mismatch during dev)
contract SimpleOwnable {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

interface IFHE {
    /// @dev this interface is a placeholder. In prod, point to real FHE verifier contract
    function checkSignatures(bytes32[] calldata handles, bytes calldata abiEncodedCleartexts, bytes calldata decryptionProof) external view;
}

/// @title PrivScore (dev-friendly)
/// @dev Minimal contract that stores encrypted payloads, emits MetricsSubmitted,
///      and publishes scores via submitDecryptedScore. Includes an owner-toggle
///      `testingMode` to bypass external FHE/KMS checks during local testing.
contract PrivScore is SimpleOwnable {
    bool public testingMode;

    // encryptedPayload[user][modelId] -> bytes
    mapping(address => mapping(uint256 => bytes)) public encryptedPayload;

    event MetricsSubmitted(address indexed user, uint256 indexed modelId, bytes encPayload);
    event ScorePublished(address indexed user, uint256 indexed modelId, uint256 score, bytes proof);

    // NOTE: in this minimal template FHE pointer is not used — replace with real address if available
    IFHE public fheVerifier;

    constructor(address initialOwner, address fheVerifierAddr) SimpleOwnable(initialOwner) {
        testingMode = false;
        fheVerifier = IFHE(fheVerifierAddr);
    }

    /// @notice Owner can toggle test bypass to skip FHE verification (local dev only)
    function setTestingMode(bool v) external onlyOwner {
        testingMode = v;
    }

    /// @notice Store an encrypted payload on-chain (called by submitter/relayer)
    function submitEncryptedMetrics(address user, uint256 modelId, bytes calldata encPayload) external {
        encryptedPayload[user][modelId] = encPayload;
        emit MetricsSubmitted(user, modelId, encPayload);
    }

    /// @notice Publish a decrypted score. If testingMode==false, verify via FHE.checkSignatures.
    /// @dev handles: bytes32[] (handles order must match cleartexts), score: uint256, proof: bytes
    function submitDecryptedScore(
        address user,
        uint256 modelId,
        bytes32[] calldata handles,
        uint256 score,
        bytes calldata decryptionProof
    ) external {
        if (!testingMode) {
            // In production this should call the real FHE verifier which will revert if invalid.
            // If fheVerifier is zero address this will revert on external call — set fheVerifierAddr on deploy.
            fheVerifier.checkSignatures(handles, abi.encodePacked(score), decryptionProof);
        }
        emit ScorePublished(user, modelId, score, decryptionProof);
    }

    function getEncryptedPayload(address user, uint256 modelId) external view returns (bytes memory) {
        return encryptedPayload[user][modelId];
    }

    /// @notice Allow owner to update the FHE verifier contract pointer (so you can configure later)
    function setFHEVerifier(address addr) external onlyOwner {
        fheVerifier = IFHE(addr);
    }
}
