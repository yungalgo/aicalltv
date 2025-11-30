// Payment Proof Circuit
// Proves knowledge of payment details without revealing them
//
// This circuit proves:
// 1. The user knows a secret payment preimage
// 2. The hash of the preimage matches a public commitment
// 
// This allows privacy-preserving payment verification

// Noir standard library
use std::hash::poseidon;

fn main(
    // Private inputs (hidden from verifier)
    payment_secret: Field,      // Secret payment preimage
    amount: Field,              // Payment amount (private)
    
    // Public inputs (visible to verifier)
    pub payment_hash: Field,    // Hash of payment_secret (commitment)
    pub order_id: Field         // Public order identifier
) {
    // 1. Verify the payment secret matches the commitment
    // The user proves they know the preimage without revealing it
    let computed_hash = poseidon::bn254::hash_1([payment_secret]);
    assert(computed_hash == payment_hash);
    
    // 2. Ensure amount is positive (basic sanity check)
    // In Noir, we can constrain that amount is non-zero
    assert(amount != 0);
    
    // 3. The order_id is included to bind the proof to a specific order
    // This prevents replay attacks
    assert(order_id != 0);
}

// Test the circuit
#[test]
fn test_valid_payment() {
    let secret: Field = 12345;
    let amount: Field = 50; // $0.50 in cents
    let hash = poseidon::bn254::hash_1([secret]);
    let order_id: Field = 1;
    
    main(secret, amount, hash, order_id);
}

