import {
  AlterDatabase,
  AlterFunction,
  AlterProcedure,
  AlterTable,
  AlterView,
  ColumnsOf,
  CompatiableObjectName,
  CompatibleTable,
  Condition,
  CreateDatabase,
  CreateFunction,
  CreateIndex,
  CreateProcedure,
  CreateSequence,
  CreateTable,
  CreateView,
  Delete,
  DropDatabase,
  DropFunction,
  DropIndex,
  DropProcedure,
  DropSequence,
  DropTable,
  DropView,
  Field,
  Insert,
  RowObject,
  Scalar,
  Statement,
  Update,
  CompatibleExpression,
  SQL
} from '../core';

export abstract class MigrateBuilder {
  use(name: string): Statement {
    return SQL.use(name);
  }

  alterDatabase(name: string): AlterDatabase {
    return SQL.alterDatabase(name);
  }
  createDatabase(name: string): CreateDatabase {
    return SQL.createDatabase(name);
  }
  dropDatabase(name: string): DropDatabase {
    return SQL.dropDatabase(name);
  }

  sql(statement: Statement | string): Statement {
    return Statement.isStatement(statement) ? statement : SQL.raw(statement);
  }

  createTable(name: CompatiableObjectName): CreateTable {
    return SQL.createTable(name);
  }

  alterTable(name: CompatiableObjectName): AlterTable {
    return SQL.alterTable(name);
  }
  dropTable(name: CompatiableObjectName): DropTable {
    return SQL.dropTable(name);
  }

  createView(name: CompatiableObjectName): CreateView {
    return SQL.createView(name);
  }

  alterView(name: CompatiableObjectName): AlterView {
    return SQL.alterView(name);
  }

  dropView(name: CompatiableObjectName): DropView {
    return SQL.dropView(name);
  }

  createProcedure(name: CompatiableObjectName): CreateProcedure {
    return SQL.createProcedure(name);
  }

  alterProcedure(name: CompatiableObjectName): AlterProcedure {
    return SQL.alterProcedure(name);
  }
  dropProcedure(name: CompatiableObjectName): DropProcedure {
    return SQL.dropProcedure(name);
  }
  createFunction(name: CompatiableObjectName): CreateFunction {
    return SQL.createFunction(name);
  }
  alterFunction(name: CompatiableObjectName): AlterFunction {
    return SQL.alterFunction(name);
  }
  dropFunction(name: CompatiableObjectName): DropFunction {
    return SQL.dropFunction(name);
  }
  createSequence(name: CompatiableObjectName): CreateSequence {
    return SQL.createSequence(name);
  }

  createIndex(name: string): CreateIndex {
    return SQL.createIndex(name);
  }

  dropIndex(table: CompatiableObjectName, name: string): DropIndex {
    return SQL.dropIndex(table, name);
  }

  dropSequence(name: CompatiableObjectName): DropSequence {
    return SQL.dropSequence(name);
  }

  insert<T extends RowObject = any>(
    table: CompatibleTable<T, string>,
    fields?: ColumnsOf<T>[] | Field<Scalar, ColumnsOf<T>>[]
  ): Insert<T> {
    return SQL.insert(table, fields);
  }

  /**
   * 更新一个表格
   * @param table
   */
  update<T extends RowObject = any>(
    table: CompatibleTable<T, string>
  ): Update<T> {
    return SQL.update(table);
  }

  /**
   * 删除一个表格
   * @param table 表格
   */
  delete<T extends RowObject = any>(
    table: CompatibleTable<T, string>
  ): Delete<T> {
    return SQL.delete(table);
  }

  abstract renameTable(name: CompatiableObjectName, newName: string): Statement;
  abstract renameColumn(
    table: CompatiableObjectName,
    name: string,
    newName: string
  ): Statement;
  abstract renameView(name: CompatiableObjectName, newName: string): Statement;
  abstract renameIndex(
    table: CompatiableObjectName,
    name: string,
    newName: string
  ): Statement;
  abstract renameSequence(
    name: CompatiableObjectName,
    newName: string
  ): Statement;
  abstract renameProcedure(
    name: CompatiableObjectName,
    newName: string
  ): Statement;
  abstract renameFunction(
    name: CompatiableObjectName,
    newName: string
  ): Statement;
  abstract renameDatabase(name: string, newName: string): Statement;

  // abstract setPrimaryKeyComment(table: CompatiableObjectName, name: string, comment: string): Statement;

  // abstract setForeignKeyComment(table: CompatiableObjectName, name: string, comment: string): Statement;

  abstract setTableComment(
    name: CompatiableObjectName,
    comment: string
  ): Statement;
  abstract setViewComment(
    name: CompatiableObjectName,
    comment: string
  ): Statement;
  abstract setColumnComment(
    table: CompatiableObjectName,
    name: string,
    comment: string
  ): Statement;
  abstract setIndexComment(
    table: CompatiableObjectName,
    name: string,
    comment: string
  ): Statement;
  abstract setConstraintComment(
    table: CompatiableObjectName,
    name: string,
    comment: string
  ): Statement;
  abstract setSchemaComment(name: string, comment: string): Statement;
  abstract setSequenceComment(
    name: CompatiableObjectName,
    comment: string
  ): Statement;
  abstract setProcedureComment(
    name: CompatiableObjectName,
    comment: string
  ): Statement;
  abstract setFunctionComment(
    name: CompatiableObjectName,
    comment: string
  ): Statement;

  abstract dropSchemaComment(name: string): Statement;
  abstract dropSequenceComment(name: CompatiableObjectName): Statement;
  abstract dropProcedureComment(name: CompatiableObjectName): Statement;
  abstract dropFunctionComment(name: CompatiableObjectName): Statement;
  abstract dropTableComment(name: CompatiableObjectName): Statement;
  abstract dropColumnComment(
    table: CompatiableObjectName,
    name: string
  ): Statement;
  abstract dropIndexComment(
    table: CompatiableObjectName,
    name: string
  ): Statement;
  abstract dropConstraintComment(
    table: CompatiableObjectName,
    name: string
  ): Statement;

  /**
   * 将列修改为自动行标识列
   */
  abstract setAutoRowflag(
    table: CompatiableObjectName,
    column: string
  ): Statement;

  /**
   *
   */
  abstract dropAutoRowflag(
    table: CompatiableObjectName,
    column: string
  ): Statement;

  // 为列添加或修改默认值
  abstract setDefaultValue(
    table: CompatiableObjectName,
    column: string,
    defaultValue: CompatibleExpression
  ): Statement;
  // 删除列默认值约束
  abstract dropDefaultValue(
    table: CompatiableObjectName,
    column: string
  ): Statement;

  // TIPS: 因为流程控制等语句将导致无法正确生成快照，因此不在此添加条件语句等信息
  // 除非完成执行引擎，这将会是一个巨大的工作量，需要考虑的情况过多，并且因为数据，流程走向无法预测。
  // 因此规定迁移文件必须按

  // abstract existsTable(table: CompatiableObjectName): Condition;

  // abstract existsDatabase(database: string): Condition;

  // abstract existsView(name: CompatiableObjectName): Condition;

  // abstract existsFunction(name: CompatiableObjectName): Condition;

  // abstract existsProcedure(name: CompatiableObjectName): Condition;

  // abstract existsSequence(name: CompatiableObjectName): Condition;

  // 给字段增加自增属性
  abstract setIdentity(
    table: CompatiableObjectName,
    column: string,
    startValue: number,
    increment: number
  ): Statement;

  // 移除字段自增属性
  abstract dropIdentity(
    table: CompatiableObjectName,
    column: string
  ): Statement;

  /**
   * 抛出一个异常
   * @param msg 异常消息
   */
  abstract throw(errmsg: string): Statement;

  // /**
  //  * 复制一个新列
  //  * @param table
  //  * @param name
  //  * @param newName
  //  */
  // abstract copyNewColumn(
  //   table: CompatiableObjectName,
  //   name: string,
  //   newName: string
  // ): Statement | Promise<Statement>;

  // // 修改字段类型
  // abstract setColumnType(table: CompatiableObjectName, name: string, type: DbType): Statement;

  // 创建Check约束
  addCheckConstaint(
    table: CompatiableObjectName<string>,
    sql: Condition,
    name?: string
  ): Statement {
    return SQL.alterTable(table).add(builder =>
      name ? builder.check(name, sql) : builder.check(sql)
    );
  }

  dropCheckConstaint(
    table: CompatiableObjectName<string>,
    name: string
  ): Statement {
    return SQL.alterTable(table).drop(builder => builder.check(name));
  }
}
