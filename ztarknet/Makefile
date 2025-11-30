# Ztarknet Payment Proof Makefile
# Based on https://github.com/ztarknet/quickstart

.PHONY: all install-deps build-circuit prove generate-verifier deploy clean

# Default target
all: build-circuit prove generate-verifier

# Install dependencies
install-deps:
	@echo "Installing Noir..."
	curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
	noirup
	@echo "Installing Barretenberg..."
	curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash
	bbup -v 0.82.2
	@echo "Installing Garaga..."
	pip install garaga==0.18.1

# Build the Noir circuit
build-circuit:
	@echo "Building circuit..."
	cd circuit && nargo check
	cd circuit && nargo compile

# Generate witness and prove
prove:
	@echo "Generating witness..."
	cd circuit && nargo execute witness
	@echo "Generating proof..."
	cd circuit && bb prove --scheme ultra_honk --zk --oracle_hash starknet -b ./target/payment_proof.json -w ./target/witness.gz -o ./target
	@echo "Generating verifying key..."
	cd circuit && bb write_vk --scheme ultra_honk --oracle_hash starknet -b ./target/payment_proof.json -o ./target

# Generate Cairo verifier contract
generate-verifier:
	@echo "Generating verifier contract..."
	garaga gen --system ultra_starknet_zk_honk --vk ./circuit/target/vk --project-name verifier
	cd verifier && scarb build

# Generate calldata for verification
calldata:
	garaga calldata --system ultra_starknet_zk_honk \
		--proof circuit/target/proof \
		--vk circuit/target/vk \
		--public-inputs circuit/target/public_inputs > calldata.txt

# Deploy verifier contract (requires sncast setup)
deploy:
	@echo "Deploying verifier..."
	cd verifier && sncast declare --contract-name UltraStarknetZKHonkVerifier
	@echo "Note: Copy the class hash and deploy via UDC"

# Clean build artifacts
clean:
	rm -rf circuit/target
	rm -rf verifier
	rm -f calldata.txt

# Help
help:
	@echo "Ztarknet Payment Proof Commands:"
	@echo "  make install-deps    - Install Noir, BB, and Garaga"
	@echo "  make build-circuit   - Compile the Noir circuit"
	@echo "  make prove           - Generate proof and verifying key"
	@echo "  make generate-verifier - Generate Cairo verifier contract"
	@echo "  make deploy          - Deploy verifier to Ztarknet"
	@echo "  make clean           - Remove build artifacts"

