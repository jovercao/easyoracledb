import { SQL } from '../sql';
import { DbProvider } from './db-provider';
import { Executor } from './executor';
import { SqlOptions } from './sql-util';

/**
 * 事务隔离级别
 */
export enum ISOLATION_LEVEL {
  READ_COMMIT = 'READ_COMMIT',
  READ_UNCOMMIT = 'READ_UNCOMMIT',
  REPEATABLE_READ = 'REPEATABLE_READ',
  SERIALIZABLE = 'SERIALIZABLE',
  SNAPSHOT = 'SNAPSHOT',
}

export class AbortError extends Error {
  code: string = 'ABORT';
}

export abstract class Connection extends Executor {
  constructor(public readonly options: ConnectOptions) {
    super();
  }

  /**
   * 开启一个事务并在代码执行完成后自动提交，遇到错误时会自动回滚
   * 用户亦可主动调用cancel来取消当前事务，并且产生一个异常中断后续代码执行
   */
  async trans<T>(
    handler: (abort: (message?: string) => void) => Promise<T>,
    isolationLevel: ISOLATION_LEVEL = ISOLATION_LEVEL.READ_COMMIT
  ): Promise<T> {
    if (this.inTransaction) {
      throw new Error('is in transaction now');
    }
    try {
      await this.beginTrans(isolationLevel);
      const res = await handler((message: string) => {
        throw new AbortError(message || 'Abort.');
      });
      await this.commit();
      return res;
    } catch (ex) {
      if (this.inTransaction) {
        await this.rollback();
      }
      throw ex;
    }
  }

  abstract beginTrans(isolationLevel: ISOLATION_LEVEL): Promise<void>;

  abstract commit(): Promise<void>;

  abstract rollback(): Promise<void>;

  abstract readonly opened: boolean;

  abstract open(): Promise<void>;

  abstract close(): Promise<void>;

  abstract readonly inTransaction: boolean;

  /**
   * 获取当前数据库
   */
  async getDatabase(): Promise<string> {
    return await this.queryScalar(SQL.select(SQL.std.currentDatabase()));
  }

  async getDefaultSchema(): Promise<string> {
    return await this.queryScalar(SQL.select(SQL.std.defaultSchema()));
  }

  /**
   * 变更所在数据库
   * 当为null时表示登录用户默认数据库
   */
  async changeDatabase(database: string): Promise<void> {
    await this.query(SQL.use(database));
  }
}

export type ConnectOptions = {
  /**
   * 数据库方言(必须是已注册的言)，与driver二选一，必须安装相应的驱动才可正常使用
   */
  dialect?: string;
  /**
   * 驱动程序，与dialect二选一，优先使用driver
   */
  provider?: DbProvider;

  /**
   * 主机名
   */
  host: string;
  /**
   * 端口号
   */
  port?: number;
  /**
   * 连接用户名
   */
  user: string;
  /**
   * 密码
   */
  password: string;
  /**
   * 数据库名称
   */
  database?: string;
  // /**
  //  * 连接池最大连接数，单位为秒，默认为5
  //  */
  // maxConnections?: number;
  // /**
  //  * 连接池最小连接数，默认为1
  //  */
  // minConnections?: number;
  // /**
  //  * 回收未使用的连接等待时长，单位: ms，默认为30000ms
  //  */
  // recoveryConnection?: number;
  /**
   * 连接超时时长，单位: ms，默认为15000ms
   */
  connectionTimeout?: number;
  /**
   * 单个查询超时时长,单位: ms，默认为15000ms
   */
  requestTimeout?: number;
  /**
   * 编译选项
   */
  sqlOptions?: SqlOptions;
};
