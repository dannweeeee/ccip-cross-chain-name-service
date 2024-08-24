import { ethers } from "hardhat";
import { assert } from "chai";
import { BigNumber } from "ethers";

const reg_name = "alice.ccns";

let alice: any;
let chain_selector: BigNumber;

let local_simulator;

let CCNS_lookup_source: any;
let CCNS_lookup_receiver: any;
let CCNS_register: any;
let CCNS_receiver: any;

let config: {
  chainSelector_: BigNumber;
  sourceRouter_: string;
  destinationRouter_: string;
  wrappedNative_: string;
  linkToken_: string;
  ccipBnM_: string;
  ccipLnM_: string;
};

try {
  describe("CrossChainNameService Testing", async function () {
    // Deploying CCIPLocalSimulator.sol
    it("Should deploy Local Simulator and be able to call configuration", async function () {
      // alice is the first account
      [alice] = await ethers.getSigners();

      // Creating an instance of CCIPLocalSimulator.sol
      const localSimulatorFactory = await ethers.getContractFactory(
        "CCIPLocalSimulator"
      );

      // Deploying CCIPLocalSimulator.sol
      local_simulator = await localSimulatorFactory.deploy();

      // Call the configuration() function to get Router contract address.
      config = await local_simulator.configuration();

      // Chain selector
      chain_selector = config.chainSelector_;

      console.table({
        ChainSelector: chain_selector,
        SourceRouter: config.sourceRouter_,
        DestinationRouter: config.destinationRouter_,
      });

      assert.equal(
        config.sourceRouter_,
        config.destinationRouter_,
        "Source and Destination routers are not equal"
      );
    });

    it("Should be able to deploy CrossChainNameService contracts", async function () {
      const CCNS_lookup_factory = await ethers.getContractFactory(
        "CrossChainNameServiceLookup"
      );

      CCNS_lookup_source = await CCNS_lookup_factory.deploy();
      CCNS_lookup_receiver = await CCNS_lookup_factory.deploy();

      // The CCNSRegister is "source side" and will be deployed in the source chain.
      const CCNS_register_factory = await ethers.getContractFactory(
        "CrossChainNameServiceRegister"
      );

      CCNS_register = await CCNS_register_factory.deploy(
        config.sourceRouter_,
        CCNS_lookup_source.address
      );

      await CCNS_lookup_source.setCrossChainNameServiceAddress(
        CCNS_register.address
      );

      const CCNS_receiver_factory = await ethers.getContractFactory(
        "CrossChainNameServiceReceiver"
      );

      CCNS_receiver = await CCNS_receiver_factory.deploy(
        config.destinationRouter_,
        CCNS_lookup_receiver.address,
        chain_selector
      );

      await CCNS_lookup_receiver.setCrossChainNameServiceAddress(
        CCNS_receiver.address
      );

      await CCNS_register.enableChain(
        chain_selector,
        CCNS_receiver.address,
        500_000
      );

      console.log("✅ CrossChainNameService contracts deployed");
    });

    it("Should be able to register a name and verify it", async function () {
      await CCNS_register.register(reg_name);

      const source_res = await CCNS_lookup_source.lookup(reg_name);

      assert.notEqual(
        source_res,
        0,
        "Source Receiver Lookup result must not be zero"
      );
      assert.equal(
        source_res,
        alice.address,
        "Source Lookup result must be the same as the sender's address"
      );

      const destination_res = await CCNS_lookup_receiver.lookup(reg_name);

      assert.equal(
        source_res,
        destination_res,
        "Source and Destination lookups don't match."
      );

      console.table({
        Name: reg_name,
        Source: source_res,
        Destination: destination_res,
      });
    });
  });
} catch (error: any) {
  console.error(error);
}
