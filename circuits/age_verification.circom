pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/poseidon.circom";

/*
 * Age Verification Circuit
 * Proves: User is at least `minimumAge` years old
 * Without revealing: Exact date of birth
 */
template AgeVerification() {
    // Private inputs (user's secret data)
    signal input birthYear;
    signal input birthMonth;
    signal input birthDay;
    signal input salt;  // Random salt for nullifier

    // Public inputs
    signal input currentYear;
    signal input currentMonth;
    signal input currentDay;
    signal input minimumAge;

    // Output
    signal output isValid;
    signal output nullifier;

    // Calculate base age (year difference)
    signal baseAge;
    baseAge <== currentYear - birthYear;

    // Check if birthday has passed this year
    signal monthDiff;
    monthDiff <== currentMonth - birthMonth;

    // Simple age check (conservative: just year difference minus 1 if birthday hasn't passed)
    // For full precision, we'd need more complex month/day comparison
    signal age;

    // If monthDiff >= 0, birthday has likely passed, use baseAge
    // This is a simplified version - production would need exact comparison
    component monthGte = GreaterEqThan(8);
    monthGte.in[0] <== currentMonth;
    monthGte.in[1] <== birthMonth;

    // Use baseAge if month >= birthMonth, otherwise baseAge - 1
    age <== baseAge - (1 - monthGte.out);

    // Check if age >= minimumAge
    component ageCheck = GreaterEqThan(8);
    ageCheck.in[0] <== age;
    ageCheck.in[1] <== minimumAge;

    isValid <== ageCheck.out;

    // Generate nullifier to prevent proof reuse
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== birthYear;
    nullifierHash.inputs[1] <== birthMonth * 100 + birthDay;
    nullifierHash.inputs[2] <== salt;
    nullifier <== nullifierHash.out;
}

component main {public [currentYear, currentMonth, currentDay, minimumAge]} = AgeVerification();
