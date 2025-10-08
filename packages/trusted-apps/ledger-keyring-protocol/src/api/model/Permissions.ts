/**
 * https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/5865144361/ARCH+LKRP+-+v2+specifications#Member-permissions
 */
export enum Permissions {
  OWNER = 0xffffffff, // Owners of the stream have access to everything
  CAN_ENCRYPT = 1, // The member can have access to the stream private key
  CAN_DERIVE = 1 << 1, // The member can have access to the stream chain code (if a member have access to the private key and the chain code it is able to derive sub-streams)
  CAN_ADD_BLOCK = 1 << 2, // The member is authorized to issue blocks in the current stream
}
