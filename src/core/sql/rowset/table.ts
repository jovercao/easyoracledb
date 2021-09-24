import { SQL_SYMBOLE } from '../sql';
import { Field } from '../expression/field';
import { CompatiableObjectName, DBObject } from '../object/db-object';
import { Star } from '../statement/crud/star';
import { ColumnsOf, DbValueType, DefaultRowObject, RowObject } from '../types';
import { Rowset } from './rowset';
import { TableVariant } from './table-variant';
import { ProxiedTableVariant } from '.';

/**
 * 表对象，表和视图均使用该对象
 */
export class Table<
    T extends RowObject = DefaultRowObject
  >
  extends Rowset<T>
  implements DBObject
{
  constructor(name: CompatiableObjectName, builtIn = false) {
    super();
    this.$name = name;
    this.$builtin = builtIn;
    this.$proxy();
  }

  static create<
    T extends RowObject = DefaultRowObject,
    N extends string = string
  >(name: CompatiableObjectName<N>, builtIn = false): ProxiedTable<T> {
    return new Table<T>(name, builtIn) as ProxiedTable<T>;
  }

  $name: CompatiableObjectName;
  readonly $builtin: boolean;
  $type: SQL_SYMBOLE.TABLE = SQL_SYMBOLE.TABLE;

  // /**
  //  * 访问字段
  //  * @param name 节点名称
  //  */
  // field<P extends ColumnsOf<T>>(name: P): Field<T[P], P> {
  //   if (this.$alias) {
  //     return super.field(name);
  //   }
  //   return new Field<T[P], P>([name, ...pathName(this.$name)] as Name<P>);
  // }

  as!: <N extends string>(alias: N) => ProxiedTable<T>;

  static isTable(object: any): object is Table | ProxiedTable {
    return object?.$type === SQL_SYMBOLE.TABLE;
  }
}

export type CompatibleTable<
  // eslint-disable-next-line
  T extends RowObject = {}
> = CompatiableObjectName | ProxiedTable<T> | ProxiedTableVariant<T>;

/**
 * 代理后的表
 */
export type ProxiedTable<
  T extends RowObject = RowObject
> = Table<T> &
  {
    readonly [P in ColumnsOf<T>]: Field<DbValueType<T[P]>, P>;
  };
