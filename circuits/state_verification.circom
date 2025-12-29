pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

/*
 * State Verification Circuit
 * Proves: User resides in a specific Indian state
 * Without revealing: Full address or pincode
 *
 * Indian pincode zones:
 * - First digit indicates postal zone (1-9)
 * - First two digits narrow down to state/region
 */
template StateVerification() {
    // Private inputs
    signal input pincode;  // 6-digit pincode as number
    signal input salt;

    // Public inputs
    signal input requiredStateCode;  // First 2 digits expected

    // Output
    signal output isFromState;
    signal output nullifier;

    // Extract first 2 digits of pincode (state code)
    // pincode / 10000 gives first 2 digits
    signal stateCode;
    stateCode <-- pincode \ 10000;

    // Verify the division is correct
    signal remainder;
    remainder <== pincode - stateCode * 10000;

    // Ensure remainder < 10000 (valid)
    component remainderCheck = LessThan(32);
    remainderCheck.in[0] <== remainder;
    remainderCheck.in[1] <== 10000;

    // Ensure stateCode is 2 digits (10-99)
    component stateCodeGte = GreaterEqThan(8);
    stateCodeGte.in[0] <== stateCode;
    stateCodeGte.in[1] <== 10;

    component stateCodeLt = LessThan(8);
    stateCodeLt.in[0] <== stateCode;
    stateCodeLt.in[1] <== 100;

    // Check if state matches required
    component stateMatch = IsEqual();
    stateMatch.in[0] <== stateCode;
    stateMatch.in[1] <== requiredStateCode;

    // Valid if: state matches AND division is valid AND stateCode is 2 digits
    // Break into quadratic constraints (R1CS allows only 2 signals per multiplication)
    signal temp1;
    signal temp2;
    temp1 <== stateMatch.out * remainderCheck.out;
    temp2 <== stateCodeGte.out * stateCodeLt.out;
    isFromState <== temp1 * temp2;

    // Generate nullifier
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== pincode;
    nullifierHash.inputs[1] <== salt;
    nullifier <== nullifierHash.out;
}

component main {public [requiredStateCode]} = StateVerification();
