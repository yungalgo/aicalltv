import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying PIIVault contract...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying from address:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    console.error("❌ Error: Account has no ETH. Please fund your wallet first.");
    process.exit(1);
  }

  // Deploy the contract
  console.log("📝 Deploying PIIVault...");
  const PIIVault = await ethers.getContractFactory("PIIVault");
  const piiVault = await PIIVault.deploy();

  await piiVault.waitForDeployment();

  const contractAddress = await piiVault.getAddress();
  
  console.log("\n✅ PIIVault deployed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📍 Contract Address:", contractAddress);
  console.log("👤 Owner:", deployer.address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("\n📋 Next Steps:");
  console.log("1. Copy the contract address above");
  console.log("2. Add it to your .env file as VITE_PII_VAULT_ADDRESS");
  console.log("3. If needed, call setBackendService() to update the backend address");
  
  // Save deployment info to file
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    contractAddress,
    owner: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  
  const fs = await import("fs");
  fs.writeFileSync(
    "./deployments/latest.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n📁 Deployment info saved to ./deployments/latest.json");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});

