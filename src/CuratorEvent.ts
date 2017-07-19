/**
 * @module node-zk-treecache
 */
/**  */
import { Stat } from "node-zookeeper-client"
import { ZooKeeperStat } from "./TreeCache"

/**
 * The kind of event emitted by the curator.
 * Please note that not all of them are implemented yet.
 */
export enum CuratorEventType {
  /**
   * Corresponds to {@link CuratorFramework#create()}
   */
  // CREATE,

  /**
   * Corresponds to {@link CuratorFramework#delete()}
   */
  // DELETE,

  /**
   * Corresponds to {@link CuratorFramework#checkExists()}
   */
  EXISTS,

  /**
     * Corresponds to {@link CuratorFramework#getData()}
     */
  GET_DATA,

  /**
     * Corresponds to {@link CuratorFramework#setData()}
     */
  // SET_DATA,

  /**
     * Corresponds to {@link CuratorFramework#getChildren()}
     */
  CHILDREN

  /**
   * Corresponds to {@link CuratorFramework#sync(String, Object)}
   */
  // SYNC,

  /**
   * Corresponds to {@link CuratorFramework#getACL()}
   */
  // GET_ACL,

  /**
   * Corresponds to {@link CuratorFramework#setACL()}
   */
  // SET_ACL,

  /**
   * Corresponds to {@link CuratorFramework#transaction()}
   */
  // TRANSACTION,

  /**
   * Corresponds to {@link CuratorFramework#getConfig()}
   */
  // GET_CONFIG,

  /**
   * Corresponds to {@link CuratorFramework#reconfig()}
   */
  // RECONFIG,

  /**
   * Corresponds to {@link Watchable#usingWatcher(Watcher)} or {@link Watchable#watched()}
   */
  // WATCHED,

  /**
   * Corresponds to {@link CuratorFramework#watches()} ()}
   */
  // REMOVE_WATCHES,

  /**
   * Event sent when client is being closed
   */
  // CLOSING
}

// TODO Verify if the stat property can be undefined or not
export type CuratorEvent =
  | GetDataCuratorEvent
  | GetChildrenCuratorEvent
  | ExistsCuratorEvent

export enum ZooKeeperCode {
  // noinspection JSUnusedGlobalSymbols
  OK = 0,
  SYSTEMERROR = -1,
  RUNTIMEINCONSISTENCY = -2,
  DATAINCONSISTENCY = -3,
  CONNECTIONLOSS = -4,
  MARSHALLINGERROR = -5,
  UNIMPLEMENTED = -6,
  OPERATIONTIMEOUT = -7,
  BADARGUMENTS = -8,
  NEWCONFIGNOQUORUM = -13,
  RECONFIGINPROGRESS = -14,
  UNKNOWNSESSION = -12,
  APIERROR = -100,
  NONODE = -101,
  NOAUTH = -102,
  BADVERSION = -103,
  NOCHILDRENFOREPHEMERALS = -108,
  NODEEXISTS = -110,
  NOTEMPTY = -111,
  SESSIONEXPIRED = -112,
  INVALIDCALLBACK = -113,
  INVALIDACL = -114,
  AUTHFAILED = -115,
  SESSIONMOVED = -118,
  NOTREADONLY = -119,
  EPHEMERALONLOCALSESSION = -120,
  NOWATCHER = -121,
  RECONFIGDISABLED = -123
}

export interface GetDataCuratorEvent {
  readonly type: CuratorEventType.GET_DATA
  readonly path: string
  readonly stat: ZooKeeperStat | undefined
  readonly data: Buffer | undefined
  readonly returnCode: ZooKeeperCode
}

export interface GetChildrenCuratorEvent {
  readonly type: CuratorEventType.CHILDREN
  readonly path: string
  readonly stat: ZooKeeperStat | undefined
  readonly children: string[] | undefined
  readonly returnCode: ZooKeeperCode
}

export interface ExistsCuratorEvent {
  readonly type: CuratorEventType.EXISTS
  readonly path: string
  readonly stat: ZooKeeperStat | null
  readonly returnCode: ZooKeeperCode
}

/**
 *
 * @private
 * @param path
 * @param stat
 * @param data
 * @param returnCode
 */
export function createGetDataCuratorEvent(
  path: string,
  stat: Stat | undefined,
  data: Buffer | undefined,
  returnCode: ZooKeeperCode
): GetDataCuratorEvent {
  return {
    type: CuratorEventType.GET_DATA,
    path,
    stat: (stat as any) as ZooKeeperStat,
    data,
    returnCode
  }
}

/**
 *
 * @private
 * @param path
 * @param stat
 * @param children
 * @param returnCode
 */
export function createGetChildrenCuratorEvent(
  path: string,
  stat: Stat | undefined,
  children: string[] | undefined,
  returnCode: ZooKeeperCode
): GetChildrenCuratorEvent {
  return {
    type: CuratorEventType.CHILDREN,
    path,
    stat: (stat as any) as ZooKeeperStat,
    children,
    returnCode
  }
}

export function createExistsCuratorEvent(
  path: string,
  stat: Stat | null,
  returnCode: ZooKeeperCode
): ExistsCuratorEvent {
  return {
    type: CuratorEventType.EXISTS,
    path,
    stat: (stat as any) as ZooKeeperStat,
    returnCode
  }
}
