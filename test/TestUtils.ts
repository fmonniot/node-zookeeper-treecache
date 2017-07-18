import { Client } from "node-zookeeper-client"

export class ZooKeeperP {
  constructor(private client: Client) {}

  create(path: string, data?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const cb = (err, p) => {
        if (err) reject(err)
        else resolve(p)
      }
      if (data) this.client.create(path, Buffer.from(data, "utf8"), cb)
      else this.client.create(path, cb)
    })
  }

  exists(path: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.client.exists(path, (err, stat) => {
        if (err) reject(err)
        else resolve(!!stat)
      })
    })
  }

  getChildren(path: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.client.getChildren(path, (err, p) => {
        if (err) reject(err)
        else resolve(p)
      })
    })
  }

  remove(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.client.remove(path, err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  setData(path: string, data: string) {
    return new Promise<void>((resolve, reject) => {
      const cb = (err, s) => {
        if (err) reject(err)
        else resolve(s)
      }
      this.client.setData(path, Buffer.from(data, "utf8"), cb)
    })
  }

  removeRecursive(path: string): Promise<void> {
    return this.getChildren(path).then(children => {
      if (children.length > 0) {
        return Promise.all(
          children.map(p => this.removeRecursive(path + "/" + p))
        ).then(() => {
          return this.remove(path).catch(() => {
            return Promise.resolve()
          })
        })
      } else {
        return this.remove(path).catch(() => {
          return Promise.resolve()
        })
      }
    })
  }
}

export function timeout(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms)
  })
}
