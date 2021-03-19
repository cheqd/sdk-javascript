import Long from 'long';
import { Int53 } from '@cosmjs/math';
import { Secp256k1, Secp256k1Signature } from '@cosmjs/crypto';
import { makeAuthInfoBytes, makeSignBytes } from '@cosmjs/proto-signing';

import { TxRaw } from '../codec/cosmos/tx/v1beta1/tx';
import { SignMode } from '../codec/cosmos/tx/signing/v1beta1/signing';

import { sha256 } from './encoding';
import { Fee, Doc, SignDoc } from '../types';
import { publicKeyToProto } from './keys';
import { LumRegistry } from '../registry';

/**
 * Generate transaction auth info payload
 *
 * @param publicKey wallet public key (secp256k1)
 * @param fee requested fee
 * @param sequence account sequence number
 */
export const generateAuthInfoBytes = (publicKey: Uint8Array, fee: Fee, sequence: number, signMode: SignMode): Uint8Array => {
    const pubkeyAny = publicKeyToProto(publicKey);
    const gasLimit = Int53.fromString(fee.gas).toNumber();
    return makeAuthInfoBytes([pubkeyAny], fee.amount, gasLimit, sequence, signMode);
};

/**
 * Generate transaction doc to be signed
 *
 * @param doc document to create the sign version
 * @param publicKey public key used for signature
 * @param signMode signing mode for the transaction
 */
export const generateSignDoc = (doc: Doc, publicKey: Uint8Array, signMode: SignMode): SignDoc => {
    const txBody = {
        messages: doc.messages,
        memo: doc.memo,
    };
    const bodyBytes = LumRegistry.encode({
        typeUrl: '/cosmos.tx.v1beta1.TxBody',
        value: txBody,
    });

    return {
        bodyBytes,
        authInfoBytes: generateAuthInfoBytes(publicKey, doc.fee, doc.sequence, signMode),
        chainId: doc.chainId,
        accountNumber: Long.fromNumber(doc.accountNumber),
    };
};

/**
 * Generate transaction sign doc bytes used to sign the transaction
 *
 * @param signDoc sign doc (as generated by the generateSignDoc function)
 */
export const generateSignDocBytes = (signDoc: SignDoc): Uint8Array => {
    return makeSignBytes(signDoc);
};

/**
 * Generate transaction signature
 *
 * @param hashedMessage sha256 hash of the sign doc bytes (as generated by the generateSignDocBytes function)
 * @param privateKey private key used to sign the transaction (secp256k1)
 */
export const generateSignature = async (hashedMessage: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> => {
    const signature = await Secp256k1.createSignature(hashedMessage, privateKey);
    return new Uint8Array([...signature.r(32), ...signature.s(32)]);
};

/**
 * Generate transaction bytes to broadcast
 *
 * @param signDoc sign doc (as generated by the generateSignDoc function)
 * @param signature transaction signature (as generated by the generateSignature function)
 */
export const generateTxBytes = (signDoc: SignDoc, signature: Uint8Array) => {
    const txRaw = TxRaw.fromPartial({
        bodyBytes: signDoc.bodyBytes,
        authInfoBytes: signDoc.authInfoBytes,
        signatures: [signature],
    });
    return Uint8Array.from(TxRaw.encode(txRaw).finish());
};

/**
 * Verify that a transaction signature is valid
 *
 * @param signature transaction signature (as generated by the generateSignature function)
 * @param signDocBytes sign doc bytes (as generated by the generateSignDocBytes function)
 * @param publicKey public key of the signing key pair (secp256k1)
 */
export const verifySignature = async (signature: Uint8Array, signDocBytes: Uint8Array, publicKey: Uint8Array): Promise<boolean> => {
    const valid = await Secp256k1.verifySignature(Secp256k1Signature.fromFixedLength(signature), sha256(signDocBytes), publicKey);
    return valid;
};
