/*
 * This file contains functions that aid in assessing the state of the web3 connection.
 */

import Geohash from 'latlon-geohash';
const geolib = require('geolib');
const MintableTokenJSON = require('./../contracts/abi/MintableToken.json');
const RegistryJSON = require('./../contracts/abi/Registry.json');
const StandardBountiesJSON = require('./../contracts/abi/StandardBountiesInterface.json');
const ParameterizerJSON = require('./../contracts/abi/Parameterizer.json');
const addresses = require('./../contracts/addresses.json');
// TODO: Make the different methods that use the address automatically
//       detect network using the Redux networkName varibale.
//       For now, we'll just manually set the network: (e.g. "rinkeby", "private", etc.):
const contractAddresses = addresses.rinkeby.contracts;

/*
 * @dev isAnyUnlockedAccount  Resolves if provider has at least one unlocked account. Rejects otherwise.
 * @param web3                Web from Web3Provider injected by Ethereum-enabled browser.
 */
export function isAnyUnlockedAccount(web3) {
  return new Promise((resolve, reject) => {
    return web3.eth.getAccounts().then(accounts => {
      if (accounts.length >= 1) { resolve(); }
      else { reject(); }
    }).catch(reject);
  });
}

/*
 * @dev getDefaultAccount     Resolves the address of the current default account from provider.
 * @param web3                Web from Web3Provider injected by Ethereum-enabled browser.
 */
export function getDefaultAccount(web3) {
  return new Promise((resolve, reject) => {
    return web3.eth.getAccounts().then(accounts => {
      if (accounts.length < 1) { throw new Error('Please unlock your MetaMask account!'); }
      resolve(accounts[0]);
    }).catch(reject);
  });
}

/*
 * @dev getNetworkName        Resolves the name of the current network the provider is connected to (e.g. Rinkeby, etc.).
 * @param web3                Web from Web3Provider injected by Ethereum-enabled browser.
 */
export function getNetworkName(web3) {
  return new Promise((resolve, reject) => {
    return web3.eth.net.getNetworkType().then(resolve).catch(reject);
  });
}

/*
 * @dev getNitrogenBalance    Resolves the balance of NTN tokens for the provided account address.
 * @param web3                Web from Web3Provider injected by Ethereum-enabled browser.
 * @param address             Address of the account to return the balance of NTN tokens of.
 */
export function getNitrogenBalance(web3, address) {
  return new Promise((resolve, reject) => {
    const erc20ContractAddress = contractAddresses.Nitrogen;
    const erc20Contract = new web3.eth.Contract(MintableTokenJSON.abi, erc20ContractAddress);

    return erc20Contract.methods.balanceOf(address).call().then(resolve).catch(reject);
  });
}

/*
 * @dev getBounties           Resolves an array of objects, each containing a the bounty data object,
 *                            including a coordinates (lat/lon) field and bounty.
 *                            (e.g.: [{title: "...", location: {lat: "...", lon: "..."}, ...}, ...] )
 * @param web3                Web from Web3Provider injected by Ethereum-enabled browser.
 */
export function getBounties(web3) {
  return new Promise((resolve, reject) => {
    const registryContractAddress = contractAddresses.Registry;
    const registryContract = new web3.eth.Contract(RegistryJSON.abi, registryContractAddress);

    // TODO: refactor away from callback hell

    // Get the total number of bounties
    return registryContract.methods.getNumBounties().call().then(numListings => {
      const bountyData: any[] = []; // Bounty return array
      if (numListings === 0) { return []; }

      // Recursively iterate over listings (asynchronously)
      return (function nextBounty (i) {
        // Get bounty ID from listing
        registryContract.methods.getBountyID(i - 1).call().then((bountyID: number) => {
          // Get bounty balance from listing
          registryContract.methods.getBountyBalance(i - 1).call().then((bountyBalance: number) => {
            // Get bounty `data` field from listing
            registryContract.methods.getBountyData(i - 1).call().then((dataString: string) => {
              const dataObj: any = JSON.parse(dataString);

              // Check that bounty has a geohash set (otherwise it will throw an error if the geohash field is empty)
              if (dataObj.payload.geohashes && dataObj.payload.geohashes.length > 0) {
                // Construct array of coordinates (lat/lon pairs by spliting
                // string of geohashes and removing spaces, before decoding)
                const coordinates = dataObj.payload.geohashes.replace(/\s/g, '').split(',').map(Geohash.decode);
                // Push bounty to return array
                bountyData.push({
                  ...dataObj.payload,
                  coordinates,
                  center: geolib.getCenter(coordinates),
                  bountyID,
                  balance: bountyBalance
                });
              } else {
                console.error('Empty `geohash` field, unable to display bounty on map! Bounty ID: ' + (i - 1));
              }
              if (--i) { return nextBounty(i); } // Decrement i and call nextBounty again if i > 0
              else { return resolve(bountyData); } // Last iteration
            }).catch(reject);
          }).catch(reject);
        }).catch(reject);
      })(numListings);
    }).catch(reject);
  });
}

/*
 * @dev contributeToBounty    Contribute NTN to a bounty. The approve() function of the Nitrogen token
 *                            is called to get the amount of transfered token approved by the user.
 * @param web3                Web from Web3Provider injected by Ethereum-enabled browser.
 * @param bountyID            The ID of the bounty to contribute the token to.
 * @param amountToken         The amount of NTN token to contribute to the bounty.
 */
export function contributeToBounty(web3: any, bountyID: number, amountToken: number) {
  return new Promise((resolve, reject) => {
    const erc20ContractAddress = web3.utils.toChecksumAddress(contractAddresses.Nitrogen);
    const erc20Contract = new web3.eth.Contract(MintableTokenJSON.abi, erc20ContractAddress);

    const bountiesContractAddress = web3.utils.toChecksumAddress(contractAddresses.StandardBounties);
    const bountiesContract = new web3.eth.Contract(StandardBountiesJSON.abi, bountiesContractAddress);

    // Get the default (active) MetaMask account address
    return getDefaultAccount(web3).then((accountAddr: any) => {
      // Get the amount of token to contribute approved
      return erc20Contract.methods.approve(bountiesContractAddress, amountToken).send({ from: accountAddr }).then((success: boolean) => {
        if (!success) { return reject('Error getting the token approved.'); }

        // Get current gas price
        return web3.eth.getGasPrice().then((price: number) => {
          // Contribute to bounty
          return bountiesContract.methods.contribute(bountyID, amountToken).send({ from: accountAddr, gasPrice: price, gas: 250000 }).then(resolve).catch(reject);
        }).catch(reject);
      }).catch(reject);
    }).catch(reject);
  });
}

/*
 * @dev issueBounty           Submits a bounty for the provided form values.
 * @param web3                Web from Web3Provider injected by Ethereum-enabled browser.
 * @param formValues          A data object used to create the bounty. This data must obey the
 *                            schema detailed here: https://github.com/flyingcarpet-network/Flyingcarpet-TCR/tree/feature/Update-README-for-TCRO#registry-contract-functions
 * @param coordinatePoints    An array of coordinates for each vertex of the selected polygon (not geohashes).
 *                            Used for the sole purpose of generating a human-readable bounty description.
 */
export function submitBounty(web3, formValues, coordinatePoints) {
  return new Promise((resolve, reject) => {
    const registryContractAddress = contractAddresses.Registry;
    const registryContract = new web3.eth.Contract(RegistryJSON.abi, registryContractAddress);

    const erc20ContractAddress = contractAddresses.Nitrogen;

    const { geohashes, useType, collectionType, droneType, fileFormat } = formValues;

    // TODO: Add extensive data validation of form values.

    // Get the center coordinate
    const centerCoord = geolib.getCenter(coordinatePoints);

    const bountyObject = {
      "payload": {
        "title":  capitalize(collectionType) + " data collection " + " for " + capitalize(useType) + " @ " + centerCoord.latitude + ", " + centerCoord.longitude,
        "description": "This is a request for aerial data collection using a " + collectionType + ". The type of the collection area is " + useType + ". Please see the details for more information about the requirements.",
        "issuer": [
          {"address": registryContractAddress}
        ],
        "funders":[],
        "categories": ["Data Collection", capitalize(collectionType), capitalize(useType)],
        "created": 1536957876,
        "tokenSymbol": "NTN",
        "tokenAddress": erc20ContractAddress,
        "geohashes": geohashes,
        "useType": useType,
        "collectionType": collectionType,
        // "radiusOfCollection": dataCollectionRadius,
        // "resolution": resolution,
        "fileFormat": fileFormat,
        "droneType": droneType
      }
    };
    const bountyDataString = JSON.stringify(bountyObject);

    // Get the default (active) MetaMask account address
    return getDefaultAccount(web3).then((accountAddr: any) => {
      // Get current gas price
      return web3.eth.getGasPrice().then((price: number) => {
        // Submit new bounty 
        return registryContract.methods.submit(bountyDataString).send({ from: accountAddr, gasPrice: price, gas: 2500000 }).then(resolve).catch(reject);
      }).catch(reject);
    }).catch(reject);
  });
}

/*
 * @dev getStakingPoolSize    Gets and returns the stakingPoolSize constant parameter from the Parameterizer (governance contract)
 * @param web3                Web from Web3Provider injected by Ethereum-enabled browser.
 */
export function getStakingPoolSize(web3) {
  return new Promise((resolve, reject) => {
    const parameterizerContractAddress = contractAddresses.Parameterizer;
    const parameterizerContract = new web3.eth.Contract(ParameterizerJSON.abi, parameterizerContractAddress);

    // Get stakingPoolSize parameter from Parameterizer contract
    return parameterizerContract.methods.get('stakingPoolSize').call().then(resolve).catch(reject);
  });
}

/*
 * @dev mintToken             Mints 100 NTN tokens and sends them to the default account.
 * @param web3                Web from Web3Provider injected by Ethereum-enabled browser.
 */
export function mintToken(web3: any) {
  return new Promise((resolve, reject) => {
    const erc20ContractAddress = web3.utils.toChecksumAddress(contractAddresses.Nitrogen);
    const erc20Contract = new web3.eth.Contract(MintableTokenJSON.abi, erc20ContractAddress);

    // Get the default (active) MetaMask account address
    return getDefaultAccount(web3).then((accountAddr: any) => {
      // Mint the token
      const amountOfToken = 100;
      return erc20Contract.methods.mint(accountAddr, amountOfToken).send({ from: accountAddr }).then((res: any) => {
        if (!res) { return reject('Error minting the token.'); }
        return resolve(res); // Success
      }).catch(reject);
    }).catch(reject);
  });
}

/*
 * @dev capitalize           Simple helper function to capitalize the first letter of a string.
 * @param str                Any string to be capitalized.
 */
function capitalize(str: string) {
  if (!str || str.length === 0) { return ''; }
  return str.charAt(0).toUpperCase() + str.slice(1);
}
