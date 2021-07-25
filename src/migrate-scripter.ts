import { DbType, Name } from './types';
import {
  SqlBuilder as SQL,
  CreateTableMember,
  CreateTableMemberBuilder,
  Statement,
  TableColumnForAdd,
  TableColumnForAlter,
  KeyColumn,
  SqlBuilder,
} from './ast';
import { DbContextMetadata } from './metadata';
import { MigrateBuilder } from './migrate-builder';
import {
  CheckConstraintSchema,
  ColumnSchema,
  compareSchema,
  ConstraintSchema,
  DatabaseSchema,
  ForeignKeySchema,
  IndexSchema,
  KeyColumnSchema,
  PrimaryKeySchema,
  SchemaDifference,
  SequenceSchema,
  TableSchema,
  UniqueConstraintSchema,
} from './schema';
import { ObjectDifference } from './util/compare';
import { isNameEquals } from './util'
import { takeRight } from 'lodash'

export abstract class MigrateScripter {
  abstract insertSeedData(table: TableSchema, data: any[]): void;

  abstract useDatabase(name: string): void;

  abstract createDatabase(database: DatabaseSchema): void;

  abstract alterDatabase(database: DatabaseSchema): void;

  abstract dropDatabase(name: string): void

  abstract createIndex(table: Name, index: IndexSchema): void;

  abstract dropIndex(table: Name, name: string): void;

  abstract addForeignKey(table: Name, fk: ForeignKeySchema): void;

  abstract dropForeignKey(table: Name, name: string): void;

  abstract commentColumn(table: Name<string>, name: string, comment?: string): void;

  abstract commentTable(table: Name, comment?: string): void;

  abstract commentIndex(table: Name, name: string, comment?: string): void;

  abstract commentConstraint(table: Name, name: string, comment?: string): void;

  abstract commentForeignKey(table: Name, name: string, comment?: string): void;

  abstract setDefaultValue(table: Name, column: string, defaultValue: string): void;

  abstract dropDefaultValue(table: Name, column: string): void;

  abstract setAutoRowflag(table: Name, column: string): void;

  abstract dropAutoRowflag(table: Name, column: string): void;

  abstract dropIdentity(table: Name, column: string): void;

  abstract setIdentity(
    table: Name,
    column: string,
    start: number,
    increment: number
  ): void;

  abstract createTable(table: TableSchema): void;

  abstract alterTable(tableChanges: ObjectDifference<TableSchema>): void

  abstract dropTable(name: Name): void;

  abstract createSequence(sequence: SequenceSchema): void;

  abstract dropSequence(name: Name): void;

  abstract addColumn(table: Name, schema: ColumnSchema): void;

  abstract dropColumn(table: Name, name: string): void;

  abstract alterColumn(table: Name, column: ColumnSchema): void;

  abstract addPrimaryKey(table: Name, pk: PrimaryKeySchema): void;
  abstract dropPrimaryKey(table: Name, name: string): void;

  abstract addConstraint(table: Name, constraint: ConstraintSchema): void;

  abstract dropConstraint(table: Name, constraint: ConstraintSchema): void;
}

export class StatementMigrateScripter extends MigrateScripter {
  constructor(private builder: MigrateBuilder) {
    super()
  }
  useDatabase(name: string): void {
    this.beforeCodes.push(this.builder.use(name));
  }
  createDatabase(database: DatabaseSchema): void {
    let sql = this.builder.createDatabase(database.name);
    if (database.collate) {
      sql.collate(database.collate);
    }
    this.beforeCodes.push(sql);
  }
  alterDatabase(database: DatabaseSchema): void {
    this.beforeCodes.push(this.builder.alterDatabase(database.name).collate(database.collate!));
  }
  dropDatabase(name: string): void {
    this.beforeCodes.push(this.builder.dropDatabase(name));
  }
  private beforeCodes: Statement[] = [];
  private afterCodes: Statement[] = [];
  private middleCodes: Statement[] = [];
  private seedDataCodes: Statement[] = [];

  insertSeedData(table: TableSchema, data: any[]): void {
    const fields = table.columns
      .filter(col => !col.isCalculate)
      .map(col => col.name);
    const rows = data.map(item => {
      const row: Record<string, any> = {};
      fields.forEach(field => (row[field] = item[field]));
      return row;
    });
    const identityColumn = table.columns.find(col => col.isIdentity);
    let sql = this.builder.insert(table.name).values(rows);
    if (identityColumn) {
      sql.withIdentity();
    }
    this.seedDataCodes.push(sql);
  }

  getScripts(): Statement[] {
    return [
      ...this.beforeCodes,
      ...this.middleCodes,
      ...this.afterCodes,
      ...this.seedDataCodes,
    ];
  }

  createIndex(table: Name, index: IndexSchema): void {
    this.middleCodes.push(
      this.builder.createIndex(index.name).on(
        table,
        index.columns.map(
          col =>
            ({
              name: col.name,
              sort: col.isAscending ? 'ASC' : 'DESC',
            } as KeyColumn)
        )
      )
    );
  }

  dropIndex(table: Name, name: string): void {
    this.middleCodes.push(this.builder.dropIndex(table, name));
  }

  addForeignKey(table: Name, fk: ForeignKeySchema) {
    this.afterCodes.push(
      this.builder
        .alterTable(table)
        .add(g =>
          g
            .foreignKey(fk.name)
            .on(fk.columns)
            .reference(fk.referenceTable, fk.referenceColumns)
        )
    );
  }

  dropForeignKey(table: Name, name: string) {
    this.beforeCodes.push(this.builder.alterTable(table).dropForeignKey(name));
  }

  commentColumn(table: Name<string>, name: string, comment?: string) {
    if (comment) {
      this.middleCodes.push(
        this.builder.setColumnComment(table, name, comment)
      );
    } else {
      this.middleCodes.push(this.builder.dropColumnComment(table, name));
    }
  }

  commentTable(table: Name, comment?: string) {
    if (comment) {
      this.middleCodes.push(this.builder.setTableComment(table, comment));
    } else {
      this.middleCodes.push(this.builder.dropTableComment(table));
    }
  }

  commentIndex(table: Name, name: string, comment?: string) {
    if (comment) {
      this.middleCodes.push(this.builder.setIndexComment(table, name, comment));
    } else {
      this.middleCodes.push(this.builder.dropIndexComment(table, name));
    }
  }

  commentConstraint(table: Name, name: string, comment?: string) {
    if (comment) {
      this.middleCodes.push(
        this.builder.setConstraintComment(table, name, comment)
      );
    } else {
      this.middleCodes.push(this.builder.dropConstraintComment(table, name));
    }
  }

  commentForeignKey(table: Name, name: string, comment?: string) {
    if (comment) {
      this.middleCodes.push(
        this.builder.setConstraintComment(table, name, comment)
      );
    } else {
      this.middleCodes.push(this.builder.dropConstraintComment(table, name));
    }
  }

  setDefaultValue(table: Name, column: string, defaultValue: string) {
    this.middleCodes.push(
      this.builder.setDefaultValue(table, column, SQL.raw(defaultValue))
    );
  }

  dropDefaultValue(table: Name, column: string) {
    this.middleCodes.push(this.builder.dropDefaultValue(table, column));
  }

  setAutoRowflag(table: Name, column: string) {
    this.middleCodes.push(this.builder.setAutoRowflag(table, column));
  }

  dropAutoRowflag(table: Name, column: string) {
    this.middleCodes.push(this.builder.dropAutoRowflag(table, column));
  }

  dropIdentity(table: Name, column: string) {
    this.middleCodes.push(this.builder.dropIdentity(table, column));
  }

  setIdentity(table: Name, column: string, start: number, increment: number) {
    this.middleCodes.push(
      this.builder.setIdentity(table, column, start, increment)
    );
  }

  createTable(table: TableSchema): void {
    this.middleCodes.push(
      this.builder.createTable(table.name).as(g => [
        ...table.columns.map(schema =>
          this.tableColumnForAdd(g.column, schema)
        ),
        g.primaryKey(table.primaryKey!.name).on(
          table.primaryKey!.columns.map(
            c =>
              ({
                name: c.name,
                sort: c.isAscending ? 'ASC' : 'DESC',
              } as KeyColumn)
          )
        ),
      ])
    );

    table.indexes.forEach(index => {
      this.createIndex(table.name, index);
    });

    table.foreignKeys.forEach(fk => {
      this.addForeignKey(table.name, fk);
    });

    table.constraints.forEach(constraint => {
      this.addConstraint(table.name, constraint);
    });

    if (table.comment) {
      this.commentTable(table.name, table.comment);
    }

    table.columns.forEach(column => {
      if (column.isRowflag) {
        this.setAutoRowflag(table.name, column.name);
      }
      if (column.comment) {
        this.commentColumn(table.name, column.name, column.comment);
      }
    });

    table.indexes.forEach(index => {
      if (index.comment) {
        this.commentIndex(table.name, index.name, index.comment);
      }
    });

    table.foreignKeys.forEach(fk => {
      if (fk.comment) {
        this.commentForeignKey(table.name, fk.comment);
      }
    });

    if (table.seedData?.length) {
      this.insertSeedData(table, table.seedData);
    }
  }

  alterTable(tableChanges: ObjectDifference<TableSchema>): void {
    const tableName = tableChanges.target!.name;
    // PRIMARY KEY
    if (tableChanges.changes?.primaryKey) {
      if (tableChanges.changes.primaryKey.added) {
        this.addPrimaryKey(tableName, tableChanges.changes.primaryKey.added);
      }

      if (tableChanges.changes.primaryKey.removed) {
        this.dropPrimaryKey(
          tableName,
          tableChanges.changes.primaryKey.removed.name
        );
      }

      if (tableChanges.changes?.primaryKey.changes) {
        if (
          !(
            tableChanges.changes?.primaryKey.changes.comment &&
            Object.keys(tableChanges.changes?.primaryKey.changes).length === 1
          )
        ) {
          this.dropPrimaryKey(
            tableName,
            tableChanges.changes.primaryKey.target!.name
          );
          this.addPrimaryKey(
            tableName,
            tableChanges.changes.primaryKey.source!
          );
        }

        if (tableChanges.changes?.primaryKey.changes.comment) {
          this.commentConstraint(
            tableName,
            tableChanges.changes?.primaryKey.source!.name,
            tableChanges.changes?.primaryKey.changes.comment.source
          );
        }
      }
    }

    // COLUMNS
    if (tableChanges.changes?.columns) {
      for (const col of tableChanges.changes.columns.removeds || []) {
        // const fk = findTargetForeignKey(({ table, foreignKey }) => isNameEquals(tableName, name))
        this.dropColumn(tableName, col.name);
      }
      for (const column of tableChanges.changes.columns.addeds || []) {
        this.addColumn(tableName, column);
        if (column.comment) {
          this.commentColumn(tableName, column.name, column.comment);
        }
      }

      for (const { target, source, changes } of tableChanges.changes.columns
        .changes || []) {
        if (!changes) continue;
        // 如果类型或者是否可空变化
        if (changes.type || changes.isNullable) {
          this.alterColumn(tableName, source!);
        }

        if (changes.defaultValue) {
          if (!changes.defaultValue.source) {
            this.dropDefaultValue(tableName, target!.name);
          } else {
            this.setDefaultValue(
              tableName,
              source!.name,
              changes.defaultValue.source
            );
          }
        }

        if (changes.isRowflag) {
          if (source!.isRowflag) {
            this.setAutoRowflag(tableName, source!.name);
          } else {
            this.dropAutoRowflag(tableName, source!.name);
          }
        }

        if (
          changes.isIdentity ||
          changes.identityIncrement ||
          changes.identityIncrement
        ) {
          console.debug(source, target);
          if (!source!.isIdentity) {
            this.middleCodes.push(
              SQL.note('// 敬告：因为需要重建表，在mssql中尚未实现该功能。')
            );
            this.dropIdentity(tableName, target!.name);
          } else {
            this.middleCodes.push(
              SQL.note('// 敬告：因为需要重建表，在mssql中尚未实现该功能。')
            );
            this.setIdentity(
              tableName,
              source!.name,
              source!.identityStartValue!,
              source!.identityIncrement!
            );
          }
        }

        if (changes.comment) {
          this.commentColumn(tableName, source!.name, changes.comment.source);
        }
      }
    }

    // FOREIGN KEY
    if (tableChanges.changes?.foreignKeys) {
      for (const fk of tableChanges.changes?.foreignKeys?.addeds || []) {
        this.addForeignKey(tableName, fk);
        if (fk.comment) {
          this.commentConstraint(tableName, fk.name, fk.comment);
        }
      }

      for (const { name } of tableChanges.changes?.foreignKeys?.removeds ||
        []) {
        this.dropForeignKey(tableName, name);
      }

      for (const { source, target, changes } of tableChanges.changes
        ?.foreignKeys?.changes || []) {
        this.dropForeignKey(tableName, target!.name);
        this.addForeignKey(tableName, source!);
        if (changes?.comment) {
          this.commentConstraint(
            tableName,
            target!.name,
            changes.comment.source
          );
        }
      }
    }

    // CONSTRAINT
    if (tableChanges.changes?.constraints) {
      for (const constraint of tableChanges.changes.constraints.addeds || []) {
        this.addConstraint(tableName, constraint);

        if (constraint.comment) {
          this.commentConstraint(
            tableName,
            constraint.name,
            constraint.comment
          );
        }
      }

      for (const constraint of tableChanges.changes.constraints.removeds ||
        []) {
        this.dropConstraint(tableName, constraint);
      }

      for (const { source, target, changes } of tableChanges.changes.constraints
        .changes || []) {
        this.dropConstraint(tableName, target!);
        this.addConstraint(tableName, source!);
        if (changes?.comment) {
          this.commentConstraint(
            tableName,
            target!.name,
            changes.comment.source
          );
        }
      }
    }

    // INDEXES
    if (tableChanges.changes?.indexes) {
      for (const index of tableChanges.changes.indexes.addeds || []) {
        this.createIndex(tableName, index);
        if (index.comment) {
          this.commentIndex(tableName, index.name, index.comment);
        }
      }

      for (const index of tableChanges.changes.indexes.removeds || []) {
        this.dropIndex(tableName, index.name);
      }

      for (const { source, target, changes } of tableChanges.changes.indexes
        .changes || []) {
        this.dropIndex(tableName, target!.name);
        this.createIndex(tableName, source!);
        if (changes?.comment) {
          this.commentIndex(tableName, source!.name, changes.comment.source);
        }
      }
    }

    if (tableChanges.changes?.comment) {
      this.commentTable(tableName, tableChanges.changes.comment.source);
    }

    // WARN: 修改表名无法追踪。
    // // 如果修改了表名
    // if (tableChanges.changes.name) {
    //   codes.push(
    //     `migrate.renameTable(${JSON.stringify(
    //       tableChanges.changes.name.source
    //     )}, ${JSON.stringify(tableChanges.changes.name.target)})`
    //   );
    // }
  }

  dropTable(name: Name): void {
    this.middleCodes.push(this.builder.dropTable(name));
  }

  createSequence(sequence: SequenceSchema): void {
    this.middleCodes.push(
      this.builder
        .createSequence(sequence.name)
        .as(SQL.raw(sequence.type))
        .startWith(sequence.startValue ?? 0)
        .incrementBy(sequence.increment ?? 1)
    );
  }

  dropSequence(name: Name): void {
    this.middleCodes.push(this.builder.dropSequence(name));
  }

  addColumn(table: Name, schema: ColumnSchema): void {
    this.middleCodes.push(
      this.builder
        .alterTable(table)
        .add(({ column }) => this.tableColumnForAdd(column, schema))
    );
  }

  dropColumn(table: Name, name: string): void {
    this.middleCodes.push(this.builder.alterTable(table).dropColumn(name));
  }

  alterColumn(table: Name, column: ColumnSchema): void {
    this.middleCodes.push(
      this.builder
        .alterTable(table)
        .alterColumn(g => this.tableColumnForAlter(g, column))
    );
  }

  addPrimaryKey(table: Name, pk: PrimaryKeySchema): void {
    this.middleCodes.push(
      this.builder.alterTable(table).add(({ primaryKey }) =>
        primaryKey(pk.name).on(
          pk.columns.map(
            col =>
              ({
                name: col.name,
                sort: col.isAscending ? 'ASC' : 'DESC',
              } as KeyColumn)
          )
        )
      )
    );
  }

  dropPrimaryKey(table: Name, name: string): void {
    this.middleCodes.push(this.builder.alterTable(table).dropPrimaryKey(name));
  }

  addConstraint(table: Name, constraint: ConstraintSchema): void {
    this.middleCodes.push(
      this.builder.alterTable(table).add(g => {
        switch (constraint.kind) {
          case 'CHECK':
            return g.check(constraint.name, SQL.raw(constraint.sql));
          case 'UNIQUE':
            return g.uniqueKey(constraint.name).on(
              constraint.columns.map(
                col =>
                  ({
                    name: col.name,
                    sort: col.isAscending ? 'ASC' : 'DESC',
                  } as KeyColumn)
              )
            );
        }
      })
    );
  }

  dropConstraint(table: Name, constraint: ConstraintSchema): void {
    switch (constraint.kind) {
      case 'CHECK':
        this.middleCodes.push(
          this.builder.alterTable(table).dropCheck(constraint.name)
        );
        break;
      case 'UNIQUE':
        this.middleCodes.push(
          this.builder.alterTable(table).dropUniqueKey(constraint.name)
        );
        break;
    }
  }

  private tableColumnForAlter(
    g: (name: string, type: DbType) => TableColumnForAlter,
    schema: ColumnSchema
  ): TableColumnForAlter {
    const col: TableColumnForAlter = g(schema.name, DbType.raw(schema.type));
    if (schema.isNullable) {
      col.null();
    } else {
      col.notNull();
    }
    return col;
  }

  private tableColumnForAdd(
    column: CreateTableMemberBuilder['column'],
    schema: ColumnSchema
  ): CreateTableMember {
    const col: TableColumnForAdd = column(schema.name, DbType.raw(schema.type));
    if (schema.isNullable) {
      col.null();
    } else {
      col.notNull();
    }
    if (schema.isIdentity) {
      col.identity(schema.identityStartValue, schema.identityIncrement);
    }
    if (schema.isCalculate) {
      col.as(SQL.raw(schema.calculateExpression!));
    }
    if (schema.isIdentity) {
      col.identity(schema.identityStartValue, schema.identityIncrement);
    }
    if (schema.isCalculate) {
      col.as(SQL.raw(schema.calculateExpression!));
    }
    return col;
  }
}

export class ProgramMigrateScripter implements MigrateScripter {
  constructor(private resolverType?: (type: string) => DbType) {

  }

  getScripts(): string[] {
    return [
      ...this.beforeCodes,
      ...this.middleCodes,
      ...this.afterCodes,
      ...this.seedDataCodes
    ]
  }

  alterDatabase(database: DatabaseSchema): void {
    this.beforeCodes.push(`builder.alterDatabase(${this.codify(database.name)}).collate(${database.collate})`);
  }
  commentColumn(table: Name<string>, name: string, comment?: string): void {
    this.comment('Column', table, name, comment);
  }
  commentTable(table: Name<string>, comment?: string): void {
    this.comment('Table', table, comment);
  }
  commentIndex(table: Name<string>, name: string, comment?: string): void {
    this.comment('Index', table, name, comment);
  }
  commentConstraint(table: Name<string>, name: string, comment?: string): void {
    this.comment('Constraint', table, name, comment);
  }
  commentForeignKey(table: Name<string>, name: string, comment?: string): void {
    this.comment('Constraint', table, name, comment);
  }

  setAutoRowflag(table: Name<string>, column: string): void {
    throw new Error('Method not implemented.')
  }
  dropAutoRowflag(table: Name<string>, column: string): void {
    throw new Error('Method not implemented.')
  }

  private middleCodes: string[] = [];
  private beforeCodes: string[] = [];
  private afterCodes: string[] = [];
  private seedDataCodes: string[] = [];

  private stringifyType(type: string): string {
    if (!this.resolverType) return `SQL.raw('${type}')`;
    const dbType = this.resolverType(type);
    switch (dbType.name) {
      case 'BINARY':
      case 'STRING':
        return `DbType.${dbType.name.toLowerCase()}(${
          dbType.length === DbType.MAX ? 'DbType.MAX' : dbType.length
        })`;
      case 'DECIMAL':
        return `DbType.decimal(${dbType.precision}, ${dbType.digit})`;
      default:
        return 'DbType.' + dbType.name.toLowerCase();
    }
  }

  private columnForAlter(
    column: ColumnSchema,
    prefix: string = 'builder.'
  ): string {
    let sql = `${prefix}column(${this.codify(column.name)}, ${this.stringifyType(
      column.type
    )})`;
    if (column.isNullable) {
      sql += '.null()';
    } else {
      sql += '.notNull()';
    }
    return sql;
  }

  private columnForAdd(
    column: ColumnSchema,
    prefix: string = 'builder.'
  ): string {
    let sql = this.columnForAlter(column, prefix);
    if (column.isIdentity)
      sql += `.identity(${column.identityStartValue}, ${column.identityIncrement})`;
    if (column.defaultValue) {
      sql += `.default(${JSON.stringify(column.defaultValue)})`;
    }
    if (!column.isNullable) {
      sql += '.notNull()';
    } else {
      sql += '.null()';
    }
    if (column.isCalculate) {
      sql += `.as(SQL.raw(${JSON.stringify(column.calculateExpression)}))`;
    }
    return sql;
  }

  private keyColumns(columns: KeyColumnSchema[]): string {
    return (
      '{ ' +
      columns
        .map(
          ({ name, isAscending }) =>
            `${this.codify(name)}: '${isAscending ? 'ASC' : 'DESC'}'`
        )
        .join(', ') +
      ' }'
    );
  }

  private primaryKey(key: PrimaryKeySchema): string {
    let sql = `builder.primaryKey(${
      key.name ? this.codify(key.name) : ''
    }).on({ ${key.columns.map(
      ({ name, isAscending }) =>
        `${this.codify(name)}: '${isAscending ? 'ASC' : 'DESC'}'`
    )} })`;
    if (key.isNonclustered) {
      sql += '.withNoclustered()';
    }
    return sql;
  }

  private foreignKey(fk: ForeignKeySchema): string {
    let code = `builder.foreignKey(${this.codify(fk.name)}).on(${fk.columns
      .map(column => this.codify(column))
      .join(', ')}).reference(${this.codify(
      fk.referenceTable
    )}, [${fk.referenceColumns.map(column => this.codify(column)).join(', ')}])`;

    if (fk.isCascade) {
      code += 'deleteCascade()';
    }
    return code;
  }

  private codify(name: Name | undefined): string {
    if (name === '') return "''";
    if (!name) return '';

    if (typeof name === 'string') return `'${name.replace(/''/g, "''")}'`;
    return (
      '[' +
      name.map(node => `'${node.replace(/'/g, "\\'")}'`).join(', ') +
      ']'
    );
  }

  private constraint(cst: ConstraintSchema): void {
    if (cst.kind === 'CHECK') {
      return this.checkConstraint(cst);
    }
    this.uniqueConstraint(cst);
  }

  private checkConstraint(check: CheckConstraintSchema): void {
    this.middleCodes.push(`builder.check('${check.name}', SQL.raw(${check.sql}))`);
  }

  private uniqueConstraint(key: UniqueConstraintSchema): void {
    this.middleCodes.push(
      `builder.uniqueKey('${key.name}').on(${this.keyColumns(key.columns)})`
    );
  }

  createTable(table: TableSchema): void {
    const members: string[] = table.columns.map(col => this.columnForAdd(col));
    if (table.primaryKey) {
      members.push(this.primaryKey(table.primaryKey));
    }
    if (table.constraints?.length > 0) {
      table.constraints.map(cst => this.constraint(cst));
    }
    let sql = `builder.createTable(${this.codify(
      table.name
    )}).as(builder => [\n      ${members.join(`,\n      `)}\n    ])`;
    this.middleCodes.push(sql);
    if (table.foreignKeys?.length > 0) {
      table.foreignKeys.map(fk => this.addForeignKey(table.name, fk));
    }
    for (const index of table.indexes) {
      this.createIndex(table.name, index);
    }

    if (table.comment) {
      this.comment('Table', table.name, table.comment);
    }

    for (const column of table.columns) {
      if (column.isRowflag) {
        this.setAutoFlag(table.name, column.name);
      }
      if (column.comment) {
        this.comment('Column', table.name, column.name, column.comment);
      }
    }

    for (const cst of table.constraints || []) {
      if (cst.comment) {
        this.comment('Constraint', table.name, cst.name, cst.comment);
      }
    }

    for (const index of table.indexes || []) {
      if (index.comment) {
        this.comment('Index', table.name, index.name, index.comment);
      }
    }
    if (table.seedData?.length) {
      this.insertSeedData(table, table.seedData);
    }
  }

  alterTable(tableChanges: ObjectDifference<TableSchema>): void {
    const tableName = tableChanges.target!.name;
    // PRIMARY KEY
    if (tableChanges.changes?.primaryKey) {
      if (tableChanges.changes.primaryKey.added) {
        this.addPrimaryKey(tableName, tableChanges.changes.primaryKey.added);
      }

      if (tableChanges.changes.primaryKey.removed) {
        this.dropPrimaryKey(
          tableName,
          tableChanges.changes.primaryKey.removed.name
        );
      }

      if (tableChanges.changes?.primaryKey.changes) {
        if (
          !(
            tableChanges.changes?.primaryKey.changes.comment &&
            Object.keys(tableChanges.changes?.primaryKey.changes).length === 1
          )
        ) {
          this.dropPrimaryKey(
            tableName,
            tableChanges.changes.primaryKey.target!.name
          );
          this.addPrimaryKey(
            tableName,
            tableChanges.changes.primaryKey.source!
          );
        }

        if (tableChanges.changes?.primaryKey.changes.comment) {
          this.comment(
            'Constraint',
            tableName,
            tableChanges.changes.primaryKey.source!.name,
            tableChanges.changes.primaryKey.source!.comment
          );
        }
      }
    }

    // COLUMNS
    if (tableChanges.changes?.columns) {
      for (const col of tableChanges.changes.columns.removeds || []) {
        // const fk = findTargetForeignKey(({ table, foreignKey }) => isNameEquals(tableName, name))
        this.dropColumn(tableName, col.name);
      }
      for (const column of tableChanges.changes.columns.addeds || []) {
        this.addColumn(tableName, column);
        if (column.isRowflag) {
          this.setAutoFlag(tableName, column.name);
        }
        if (column.comment) {
          this.comment('Column', tableName, column.name, column.comment);
        }
      }

      for (const { target, source, changes } of tableChanges.changes.columns
        .changes || []) {
        if (!changes) continue;
        // 如果类型或者是否可空变化
        if (changes.type || changes.isNullable) {
          this.alterColumn(tableName, source!);
        }
        if (changes.isRowflag) {
          if (source!.isRowflag) {
            this.setAutoFlag(tableName, source!.name);
          } else {
            this.dropAutoFlag(tableName, source!.name);
          }
        }
        if (changes.defaultValue) {
          if (!changes.defaultValue.source) {
            this.dropDefaultValue(tableName, target!.name);
          } else {
            this.setDefaultValue(
              tableName,
              source!.name,
              changes.defaultValue.source
            );
          }
        }

        if (
          changes.isIdentity ||
          changes.identityIncrement ||
          changes.identityIncrement
        ) {
          console.debug(source, target);
          if (!source!.isIdentity) {
            this.middleCodes.push(
              '// 敬告：因为需要重建表，在mssql中尚未实现该功能。'
            );
            this.dropIdentity(tableName, target!.name);
          } else {
            this.middleCodes.push(
              '// 敬告：因为需要重建表，在mssql中尚未实现该功能。'
            );

            this.setIdentity(
              tableName,
              source!.name,
              source!.identityStartValue!,
              source!.identityIncrement!
            );
          }
        }

        if (changes.comment) {
          this.comment(
            'Column',
            tableName,
            source!.name,
            changes.comment.source
          );
        }
      }
    }

    // FOREIGN KEY
    if (tableChanges.changes?.foreignKeys) {
      for (const fk of tableChanges.changes?.foreignKeys?.addeds || []) {
        this.addForeignKey(tableName, fk);
        if (fk.comment) {
          this.comment('Constraint', tableName, fk.name, fk.comment);
        }
      }

      for (const { name } of tableChanges.changes?.foreignKeys?.removeds ||
        []) {
        this.dropForeignKey(tableName, name);
      }

      for (const { source, target, changes } of tableChanges.changes
        ?.foreignKeys?.changes || []) {
        this.dropForeignKey(tableName, target!.name);
        this.addForeignKey(tableName, source!);
        if (changes?.comment) {
          this.comment(
            'Constraint',
            tableName,
            target!.name,
            changes.comment.source
          );
        }
      }
    }

    // CONSTRAINT
    if (tableChanges.changes?.constraints) {
      for (const constraint of tableChanges.changes.constraints.addeds ||
        []) {
        this.addConstraint(tableName, constraint);

        if (constraint.comment) {
          this.comment(
            'Constraint',
            tableName,
            constraint.name,
            constraint.comment
          );
        }
      }

      for (const constraint of tableChanges.changes.constraints.removeds ||
        []) {
        this.dropConstraint(tableName, constraint);
      }

      for (const { source, target, changes } of tableChanges.changes
        .constraints.changes || []) {
        this.dropConstraint(tableName, target!);
        this.addConstraint(tableName, source!);
        if (changes?.comment) {
          this.comment(
            'Constraint',
            tableName,
            target!.name,
            changes.comment.source
          );
        }
      }
    }

    // INDEXES
    if (tableChanges.changes?.indexes) {
      for (const index of tableChanges.changes.indexes.addeds || []) {
        this.createIndex(tableName, index);
        if (index.comment) {
          this.comment('Index', tableName, index.name, index.comment);
        }
      }

      for (const index of tableChanges.changes.indexes.removeds || []) {
        this.dropIndex(tableName, index.name);
      }

      for (const { source, target, changes } of tableChanges.changes.indexes
        .changes || []) {
        this.dropIndex(tableName, target!.name);
        this.createIndex(tableName, source!);
        if (changes?.comment) {
          this.comment(
            'Index',
            tableName,
            source!.name,
            changes.comment.source
          );
        }
      }
    }

    if (tableChanges.changes?.comment) {
      this.comment('Table', tableName, tableChanges.changes.comment.source);
    }
  }

  dropPrimaryKey(table: Name<string>, name: string) {
    this.middleCodes.push(
      `builder.alterTable(${this.codify(table)}).drop(builder => builder.primaryKey(${this.codify(name)}))`
    );
  }

  dropTable(name: Name): void {
    this.middleCodes.push(`builder.dropTable(${JSON.stringify(name)})`);
  }

  dropColumn(table: Name, column: string): void {
    this.middleCodes.push(
      `builder.alterTable(${this.codify(
        table
      )}).drop(builder => builder.column(${this.codify(column)}))`
    );
  }

  setAutoFlag(table: Name<string>, column: string): void {
    this.middleCodes.push(
      `builder.setAutoRowflag(${this.codify(table)}, ${this.codify(column)})`
    );
  }

  dropAutoFlag(table: Name<string>, column: string): void {
    this.middleCodes.push(
      `builder.dropAutoRowflag(${this.codify(table)}, ${this.codify(column)})`
    );
  }

  dropConstraint(
    table: Name,
    constraint: ConstraintSchema
  ): void {
    this.middleCodes.push(
      `builder.alterTable(${this.codify(table)}).drop(builder => builder.${
        {
          CHECK: 'check',
          UNIQUE: 'uniqueKey',
          PRIMARY_KEY: 'primaryKey',
        }[constraint.kind]
      }(${this.codify(constraint.name)}))`
    );
  }

  // function genCreateIndex(table: Name, index: IndexSchema): string {
  //   return `builder.createIndex(${genName(index.name)}).on(${genName(
  //     table
  //   )}, ${genKeyColumns(index.columns)})`;
  // }

  addColumn(table: Name, column: ColumnSchema): void {
    this.middleCodes.push(
      `builder.alterTable(${this.codify(table)}).add(builder => ${this.columnForAdd(
        column
      )})`
    );
  }

  alterColumn(table: Name, column: ColumnSchema): void {
    this.middleCodes.push(
      `builder.alterTable(${this.codify(
        table
      )}).alterColumn(column => ${this.columnForAlter(column, '')})`
    );
  }

  setDefaultValue(
    table: Name,
    column: string,
    defaultValue: string
  ): void {
    this.middleCodes.push(
      `builder.setDefaultValue(${this.codify(table)}, ${this.codify(
        column
      )}, SQL.raw(${JSON.stringify(defaultValue)}))`
    );
  }

  dropDefaultValue(table: Name, column: string): void {
    this.middleCodes.push(
      `builder.dropDefaultValue(${this.codify(table)}, ${this.codify(column)})`
    );
  }

  setIdentity(
    table: Name,
    column: string,
    startValue: number,
    increment: number
  ): void {
    this.middleCodes.push(
      `builder.setIdentity(${this.codify(table)}, ${this.codify(
        column
      )}, ${startValue}, ${increment})`
    );
  }

  dropIdentity(table: Name, column: string): void {
    this.middleCodes.push(
      `builder.dropIdentity(${this.codify(table)}, ${this.codify(column)})`
    );
  }

  addForeignKey(table: Name, fk: ForeignKeySchema): void {
    this.afterCodes.push(
      `builder.alterTable(${this.codify(table)}).add(builder => ${this.foreignKey(fk)})`
    );
  }

  dropForeignKey(table: Name, name: string): void {
    this.beforeCodes.push(
      `builder.alterTable(${this.codify(
        table
      )}).drop(({ foreignKey }) => foreignKey(${this.codify(name)}))`
    );
  }

  addConstraint(table: Name, constaint: ConstraintSchema): void {
    if (constaint.kind === 'CHECK') {
      this.middleCodes.push(
        `builder.alterTable(${this.codify(
          table
        )}).add(({ check }) => check(${this.codify(constaint.name)}, SQL.raw(${
          constaint.sql
        }))`
      );
      return;
    }
    this.middleCodes.push(
      `builder.alterTable(${this.codify(
        table
      )}).add(({ uniqueKey }) => uniqueKey(${this.codify(
        constaint.name
      )}).on(${this.keyColumns(constaint.columns)}))`
    );
  }

  addPrimaryKey(table: Name, key: PrimaryKeySchema): void {
    this.middleCodes.push(
      `builder.alterTable(${this.codify(
        table
      )}).add(({ primaryKey }) => primaryKey(${this.codify(
        key.name
      )}).on(${this.keyColumns(key.columns)}))`
    );
  }

  createSequence(sequence: SequenceSchema): void {
    this.middleCodes.push(
      `builder.createSequence(${this.codify(sequence.name)}).as(${this.stringifyType(
        sequence.type
      )}).startsWith(${sequence.startValue}).incrementBy(${
        sequence.increment
      })`
    );
  }

  dropSequence(name: Name): void {
    this.middleCodes.push(`builder.dropSequence(${this.codify(name)})`);
  }

  createIndex(table: Name<string>, index: IndexSchema): void {
    let sql = `builder.createIndex(${this.codify(index.name)}).on(${this.codify(
      table
    )}, ${this.keyColumns(index.columns)})`;
    if (index.isUnique) {
      sql += '.unique()';
    }

    if (index.isClustered) {
      sql += '.clustered()';
    }
    this.middleCodes.push(sql);
  }

  dropIndex(table: Name<string>, name: string): void {
    this.middleCodes.push(`builder.dropIndex(${this.codify(table)}, ${this.codify(name)})`);
  }

  comment(
    type: 'Table' | 'Procedure' | 'Function' | 'Schema',
    object: Name<string>,
    comment?: string
  ): void;
  comment(
    type: 'Column' | 'Constraint' | 'Index',
    table: Name<string>,
    member: string,
    comment?: string
  ): void;
  comment(
    type: string,
    object: Name<string>,
    memberOrComment?: string,
    _comment?: string
  ): void {
    let member: string | undefined;
    let comment: string | undefined;
    if (['Table', 'Procedure', 'Function', 'Schema'].includes(type)) {
      comment = memberOrComment;
    } else {
      member = memberOrComment;
      comment = _comment;
    }
    let code: string;
    if (comment) {
      code = `builder.set${type}Comment(${this.codify(object)}${
        member ? `, ${this.codify(member)}` : ''
      }, ${this.codify(comment)})`;
    } else {
      code = `builder.drop${type}Comment(${this.codify(object)}${
        member ? `, ${this.codify(member)}` : ''
      })`;
    }
    this.middleCodes.push(code);
  }

  insertSeedData(table: TableSchema, data: any[]): void {
    const fields = table.columns
      .filter(col => !col.isCalculate)
      .map(col => col.name);
    const rows = data.map(item => {
      const row: Record<string, any> = {};
      fields.forEach(field => (row[field] = item[field]));
      return row;
    });
    const identityColumn = table.columns.find(col => col.isIdentity);
    let sql = `builder.insert(${this.codify(table.name)}).values(${JSON.stringify(
      rows
    )})`;
    if (identityColumn) {
      sql += '.withIdentity()';
    }
    this.seedDataCodes.push(sql);
  }

  createDatabase(database: DatabaseSchema): void {
    let sql = `builder.createDatabase(${this.codify(database.name)})`;
    if (database.collate) {
      sql += `.collate(${database.collate})`;
    }
    this.beforeCodes.push(sql);
  }

  useDatabase(name: string): void {
    this.beforeCodes.push(`builder.use(${this.codify(name)})`);
  }

  dropDatabase(name: string): void {
    this.middleCodes.push(`builder.dropDatabase(${this.codify(name)})`);
  }
}

export function generateScripts(
  source: DatabaseSchema | undefined,
  target: DatabaseSchema | undefined,
  scripter: MigrateScripter
  // resolverType?: (type: string) => DbType
): void {
  const differences = compareSchema(source, target);
  if (!differences) return;
  if (!differences.target && differences.source) {
    // 创建数据库
    scripter.createDatabase(differences.source);
    scripter.useDatabase(differences.source.name);
    differences.source.tables.forEach(table => scripter.createTable(table));
    differences.source.sequences.forEach(sequence => scripter.createSequence(sequence));
  } else if (differences.target && !differences.source) {
    // 删除数据库
    scripter.dropDatabase(differences.target.name);
  } else {
    if (differences.changes?.tables) {
      for (const table of differences.changes.tables.removeds) {
        // 删除表之前本表外键，以免多表删除时造成依赖问题
        table.foreignKeys.forEach(fk => {
          scripter.dropForeignKey(table.name, fk.name);
        });

        scripter.dropTable(table.name);
      }

      differences.changes.tables.addeds.forEach(addedTable =>
        scripter.createTable(addedTable)
      );
      differences.changes.tables.changes.forEach(diff => scripter.alterTable(diff));
    }

    if (differences.changes?.sequences) {
      for (const sequence of differences.changes.sequences.addeds || []) {
        scripter.createSequence(sequence);
      }
      for (const { name } of differences.changes.sequences.removeds || []) {
        scripter.dropSequence(name);
      }
    }
  }
}

export function generateUpdateSnapshot(
  source: DatabaseSchema,
  target: DatabaseSchema
): void {
  // const scripter = new SnapshotMigrateScripter(target);
}

export function generateUpdateStatements(
  builder: MigrateBuilder,
  source: DatabaseSchema,
  target: DatabaseSchema
  // resolverType?: (type: string) => DbType
): Statement[] {
  const scripter = new StatementMigrateScripter(builder);
  generateScripts(source, target, scripter);
  return scripter.getScripts();
}

export function generateUpdatePrograme(
  source: DatabaseSchema | undefined,
  target: DatabaseSchema | undefined,
  resolverType?: (type: string) => DbType
): string[] {
  const scripter = new ProgramMigrateScripter(resolverType);
  generateScripts(source, target, scripter);
  return scripter.getScripts();
}