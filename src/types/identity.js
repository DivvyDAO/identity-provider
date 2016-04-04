import abi from 'ethereumjs-abi';
import _ from 'lodash';
import t from 'tcomb';
import {Address, Identity} from './base';
import * as keystoreLib from '../keystore';

export const KeystoreIdentity = Identity.extend({}, 'KeystoreIdentity');

KeystoreIdentity.prototype.signTransaction = function (txParams, providerState, callback) {
  console.log(txParams);
  const keystore = keystoreLib.constructFromState(providerState);
  keystore.passwordProvider = providerState.passwordProvider;
  keystore.signTransaction(txParams, callback);
};

export const ContractIdentityMethod = t.enums({
  'sender': true,
  'owner.metatx': true,
});

/**
 * Defines a contract identity with a method to act as the identity on the
 * blockchain.
 *
 * Method versions should be thought of as a way to specify the protocol code that
 * is necessary to interact with the contracts, which will almost always be dependent
 * on the ABI of the proxy and owner contracts that implement the method.
 */
export const ContractIdentity = Identity.extend({
  methodName: ContractIdentityMethod,
  methodVersion: t.String,
  key: Address,
}, 'ContractIdentity');

ContractIdentity.prototype.signTransaction = function (txParams, providerState, callback) {
  console.log(txParams);
  // Generate the data for the proxy contract call.
  const outerTxData = abi.rawEncode(
    'forward',
    ['address', 'uint256', 'bytes'],
    [txParams.to, txParams.value || 0, txParams.data || 0]
  );

  // Insert the proxy contract call data in a new transaction sent from the
  // specified identity.
  const newParams = {
    data: `0x${outerTxData.toString('hex')}`,
    to: this.address,
    from: this.key,
  };
  // If gasPrice or gasLimit were set, copy them over.
  // TODO: It is more accurate to add the ProxyContract.forward gas cost overhead
  // to the provided gasLimit as long as it's less than the block gas limit.
  ['gasPrice', 'gasLimit'].forEach((param) => {
    if (txParams[param] != null) {
      newParams[param] = txParams[param];
    }
  });
  KeystoreIdentity({address: this.key}).signTransaction(newParams, providerState, callback);
};

export const SenderIdentity = t.refinement(
  ContractIdentity,
  (id) => id.methodName === 'sender',
  'SenderIdentity'
);

export const OwnerIdentity = t.refinement(
  ContractIdentity.extend({
    owner: Address,
  }),
  (id) => id.methodName.startsWith('owner'),
  'OwnerIdentity'
);

/**
 * A union of all types where signTransaction can be called successfully.
 *
 * e.g. Transactable(identity).signTransaction(...);
 */
export const Transactable = t.union([KeystoreIdentity, SenderIdentity]);
Transactable.dispatch = function (data) {
  if (data.methodName == null) {
    return KeystoreIdentity;
  }

  const contractMethods = {
    'sender': SenderIdentity,
  };
  return contractMethods[data.methodName];
};