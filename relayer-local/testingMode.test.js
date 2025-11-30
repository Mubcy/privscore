const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PrivScore testingMode", function () {
  let PrivScore, privScore, owner, other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    PrivScore = await ethers.getContractFactory("PrivScore");
    privScore = await PrivScore.deploy();
    await privScore.deployed();
  });

  it("defaults to false and toggles to true", async function () {
    expect(await privScore.testingMode()).to.equal(false);
    await privScore.setTestingMode(true);
    expect(await privScore.testingMode()).to.equal(true);
  });

  it("only owner can toggle (if owner-only)", async function () {
    // Attempt toggle from a non-owner signer
    await expect(
      privScore.connect(other).setTestingMode(false)
    ).to.be.reverted; // if contract uses revert message, add .withMessage("Ownable: caller is not the owner")
  });
});
