/**
 * TODO Desc module (in ConnectionState)
 * @module node-zk-treecache
 */
/**  */

/**
 * Represents state changes in the connection to ZK
 */
export enum ConnectionState {
  /**
   * Sent for the first successful connection to the server. NOTE: You will only
   * get one of these messages for any CuratorFramework instance.
   */
  CONNECTED,

  /**
     * There has been a loss of connection. Leaders, locks, etc. should suspend
     * until the connection is re-established.
     *
     * We don't have access to this event with the current ZooKeeper client...
     */
  SUSPENDED,

  /**
     * A suspended, lost, or read-only connection has been re-established
     */
  RECONNECTED,

  /**
     * <p>
     *     Curator will set the LOST state when it believes that the ZooKeeper session
     *     has expired. ZooKeeper connections have a session. When the session expires, clients must take appropriate
     *     action. In Curator, this is complicated by the fact that Curator internally manages the ZooKeeper
     *     connection. Curator will set the LOST state when any of the following occurs:
     *     a) ZooKeeper returns a {@link Watcher.Event.KeeperState#Expired} or {@link KeeperException.Code#SESSIONEXPIRED};
     *     b) Curator closes the internally managed ZooKeeper instance; c) The session timeout
     *     elapses during a network partition.
     * </p>
     *
     * <p>
     *     NOTE: see {@link CuratorFrameworkFactory.Builder#connectionHandlingPolicy(ConnectionHandlingPolicy)} for an important note about a
     *     change in meaning to LOST since 3.0.0
     * </p>
     */
  LOST,

  /**
     * The connection has gone into read-only mode. This can only happen if you pass true
     * for {@link CuratorFrameworkFactory.Builder#canBeReadOnly()}. See the ZooKeeper doc
     * regarding read only connections:
     * <a href="http://wiki.apache.org/hadoop/ZooKeeper/GSoCReadOnlyMode">http://wiki.apache.org/hadoop/ZooKeeper/GSoCReadOnlyMode</a>.
     * The connection will remain in read only mode until another state change is sent.
     */
  READ_ONLY
}

/**
 * Check if this state indicates that Curator has a connection to ZooKeeper
 *
 * @private
 * @return True if connected, false otherwise
 */
export function isConnected(cs: ConnectionState) {
  switch (cs) {
    case ConnectionState.CONNECTED:
      return true
    case ConnectionState.RECONNECTED:
      return true
    case ConnectionState.READ_ONLY:
      return true
    default:
      return false
  }
}
