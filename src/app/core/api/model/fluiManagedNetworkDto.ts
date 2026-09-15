/**
 * Flui API
 *
 * Asking Flui to build the private network itself.
 */
export interface FluiManagedNetworkDto { 
    /**
     * CIDR for the network Flui builds. Omit for the default — it is not derived from any address the nodes have, because they have none.
     */
    ipRange?: string;
}
