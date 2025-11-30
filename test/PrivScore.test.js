// test/PrivScore.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

function defaultValueForInput(input, owner) {
  const t = input.type;
  if (t === "address") return owner.address;
  if (t.startsWith("uint") || t.startsWith("int")) return 0;
  if (t === "bool") return false;
  if (t === "string") return "test";
  if (t.startsWith("bytes")) return ethers.utils.formatBytes32String("x");
  if (t.endsWith("[]")) {
    const base = t.slice(0, -2);
    if (base === "address") return [owner.address];
    if (base.startsWith("uint") || base.startsWith("int")) return [0];
    return ["test"];
  }
  return 0;
}

describe("PrivScore", function () {
  let owner, other, privScore;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    // Read constructor inputs
    const artifact = await hre.artifacts.readArtifact("PrivScore");
    const constructorAbi = artifact.abi.find((x) => x.type === "constructor");
    const ctorInputs = (constructorAbi && constructorAbi.inputs) || [];
    const args = ctorInputs.map((inp) => defaultValueForInput(inp, owner));

    const Factory = await ethers.getContractFactory("PrivScore");
    privScore = await Factory.deploy(...args);
    // ethers v6: wait for deployment with waitForDeployment()
    await privScore.waitForDeployment();
  });

  it("defaults to testingMode false and toggles", async function () {
    const tm0 = await privScore.testingMode();
    expect(tm0).to.equal(false);

    await privScore.setTestingMode(true);
    expect(await privScore.testingMode()).to.equal(true);
  });

  it("reverts when non-owner tries to toggle (if owner-only)", async function () {
    await expect(
      privScore.connect(other).setTestingMode(false)
    ).to.be.reverted;
  });
});
