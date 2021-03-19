import { LumUtils, LumConstants, LumTypes } from '..';
import { LumWallet } from '.';

export class LumPaperWallet extends LumWallet {
    private readonly mnemonic?: string;
    private privateKey?: Uint8Array;

    /**
     * Create a LumPaperWallet instance based on a mnemonic or a private key
     * This constructor is not intended to be used directly as it does not initialize the underlying key pair
     * Better use the provided static LumPaperWallet builders
     *
     * @param mnemonicOrPrivateKey mnemonic (string) used to derive the private key or private key (Uint8Array)
     */
    constructor(mnemonicOrPrivateKey: string | Uint8Array) {
        super();
        if (LumUtils.isUint8Array(mnemonicOrPrivateKey)) {
            this.privateKey = mnemonicOrPrivateKey;
        } else {
            this.mnemonic = mnemonicOrPrivateKey;
        }
    }

    canChangeAccount = (): boolean => {
        return !!this.mnemonic;
    };

    useAccount = async (hdPath = LumConstants.getLumHdPath(0, 0), addressPrefix = LumConstants.LumBech32PrefixAccAddr): Promise<boolean> => {
        if (this.mnemonic) {
            this.privateKey = await LumUtils.getPrivateKeyFromMnemonic(this.mnemonic, hdPath);
            this.publicKey = await LumUtils.getPublicKeyFromPrivateKey(this.privateKey);
            this.address = LumUtils.getAddressFromPublicKey(this.publicKey, addressPrefix);
            return true;
        } else if (this.privateKey) {
            this.publicKey = await LumUtils.getPublicKeyFromPrivateKey(this.privateKey);
            this.address = LumUtils.getAddressFromPublicKey(this.publicKey, addressPrefix);
            return false;
        }
        throw new Error('No available mnemonic or private key.');
    };

    signTransaction = async (doc: LumTypes.Doc): Promise<Uint8Array> => {
        if (!this.privateKey || !this.publicKey) {
            throw new Error('No account selected.');
        }
        const signDoc = LumUtils.generateSignDoc(doc, this.getPublicKey());
        const signBytes = LumUtils.generateSignDocBytes(signDoc);
        const hashedMessage = LumUtils.sha256(signBytes);
        const signature = await LumUtils.generateSignature(hashedMessage, this.privateKey);
        return signature;
    };
}
