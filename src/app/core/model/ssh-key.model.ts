export interface SSHKey {
  id: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  createdAt: Date;
  provider?: string;
  usedBy: string[];
}

export interface NewSSHKeyForm {
  name: string;
  publicKey?: string;
  generateNew: boolean;
}
