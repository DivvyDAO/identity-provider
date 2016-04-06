import _ from 'lodash';
import t from 'tcomb';
import * as keystoreLib from '../keystore';
import {KeystoreIdentity} from '../types/identity';


export const State = t.struct({
  web3Provider: t.Any,
  passwordProvider: t.Function,
  identities: t.list(t.Any),
  keystore: t.Any,
  defaultHdPath: t.String,
}, 'State');

export const stateDefaults = {
  defaultHdPath: "m/0'/0'/0'",
};

export const PartialState = t.struct({
  web3Provider: t.Any,
  passwordProvider: t.Function,
  identities: t.list(t.Any),
  keystore: t.Any,
  defaultHdPath: t.maybe(t.String),
}, 'PartialState');

PartialState.prototype.toState = function () {
  return State(Object.assign({}, stateDefaults, _.omitBy(this, _.isNil)));
};

State.prototype.identityForAddress = function (address) {
  const identity = _.find(this.identities, (id) => id.address === address);
  if (identity == null) {
    // Assume the address is for an identity in the keystore.
    return KeystoreIdentity({address});
  }
  return identity;
};

State.prototype.getKeyIdentity = function () {
  const keyring = keystoreLib.bestKeyring(this.keystore);
  const address = keyring.addresses[0];
  return KeystoreIdentity({address});
};
