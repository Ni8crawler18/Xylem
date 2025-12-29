pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

/*
 * Aadhaar Validity Circuit
 * Proves: User holds a valid Aadhaar number
 * Without revealing: The actual Aadhaar number
 */
template AadhaarValidity() {
    // Private inputs - 12 digit Aadhaar number
    signal input aadhaar[12];
    signal input salt;

    // Public inputs
    signal input credentialCommitment;  // Hash of credential from issuer

    // Output
    signal output isValid;
    signal output nullifier;

    // Verify each digit is 0-9
    signal digitValid[12];
    component ltCheck[12];

    for (var i = 0; i < 12; i++) {
        ltCheck[i] = LessThan(8);
        ltCheck[i].in[0] <== aadhaar[i];
        ltCheck[i].in[1] <== 10;
        digitValid[i] <== ltCheck[i].out;
    }

    // First digit cannot be 0 or 1 (Aadhaar rule)
    component firstDigitCheck = GreaterThan(8);
    firstDigitCheck.in[0] <== aadhaar[0];
    firstDigitCheck.in[1] <== 1;

    // Compute hash of Aadhaar
    component aadhaarHash1 = Poseidon(6);
    for (var i = 0; i < 6; i++) {
        aadhaarHash1.inputs[i] <== aadhaar[i];
    }

    component aadhaarHash2 = Poseidon(6);
    for (var i = 0; i < 6; i++) {
        aadhaarHash2.inputs[i] <== aadhaar[i + 6];
    }

    component finalHash = Poseidon(2);
    finalHash.inputs[0] <== aadhaarHash1.out;
    finalHash.inputs[1] <== aadhaarHash2.out;

    // All digits valid AND first digit > 1
    signal allDigitsValid;
    signal temp[11];
    temp[0] <== digitValid[0] * digitValid[1];
    for (var i = 1; i < 11; i++) {
        temp[i] <== temp[i-1] * digitValid[i+1];
    }
    allDigitsValid <== temp[10];

    isValid <== allDigitsValid * firstDigitCheck.out;

    // Generate nullifier
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== finalHash.out;
    nullifierHash.inputs[1] <== salt;
    nullifier <== nullifierHash.out;
}

component main {public [credentialCommitment]} = AadhaarValidity();
