import Program from 'commander';
import { MigrateCli, LubeConfig } from './migrate-cli';
import { existsSync } from 'fs';
import 'colors';
import { join } from 'path';
import { createContext } from './lube';

const OPTIONS_FILE = '.lubejs';

async function createMigrateCli(options: {
  context?: string;
  migrateDir?: string;
}): Promise<MigrateCli> {
  let { context, migrateDir } = options;
  if (!migrateDir) {
    migrateDir = './migrates';
  }
  const db = await createContext(context);
  const cli = await new MigrateCli(db, migrateDir);
  return cli;
}

const migrate = Program.command('migrate')
  .option('-c, --context <context>', '配置文件.lubejs.ts中的contexts[key].')
  .option(
    '-d, --dir <dir>',
    '迁移文件路径，不传递时默认为 {pwd}/migrate/{context}/。'
  )
  .description('Migration comannders.');

const migrateCreate = migrate
  .command('create <name>')
  .description('创建一个空白的迁移文件.')
  // .option('-o, --output-dir <outputDir>', '输出目录.')
  .action(async (name: string) => {
    const cli = await createMigrateCli(migrate.opts());
    try {
      await cli.create(name);
    } catch (error) {
      console.error(error.message.red);
      console.info(error.stack);
    } finally {
      await cli.dispose();
    }
  });

migrate
  .command('gen <name>')
  .description('生成数据库迁移源代码.')
  .option('-o, --output-dir <outputDir>', '输出目录.')
  .option('-n, --not-resolver-type', '生成的代码中不转换原始数据类型到DbType.')
  .action(async name => {
    const opts = migrate.opts();
    const cli = await createMigrateCli(opts);
    try {
      await cli.gen(name, opts.notResolverType);
    } catch (error) {
      console.error(error.message.red);
      console.log(error.stack);
    } finally {
      await cli.dispose();
    }
  });

migrate
  .command('list')
  .description('列出所有迁移.')
  .action(async () => {
    const cli = await createMigrateCli(migrate.opts());
    try {
      await cli.list();
    } catch (error) {
      console.error(error.message.red);
      console.log(error.stack);
    } finally {
      await cli.dispose();
    }
  });

const migrateScript = migrate
  .command('script')
  .description('生成数据库更新脚本，脚本更新方向为: <source> ==> <target>')
  .option('-o, --output-path <outputPath>', '输出目录.')
  .option(
    '-t, --target <target>',
    `目标迁移版本名称：\n  ${'*'.yellow} ---- 表示使用最新版本\n  ${
      '@'.yellow
    } ---- 表未当前数据库版本\n  不传递时使用最新版本`
  )
  .option(
    '-s, --source <source>',
    `源迁移版本名称：\n  ${'*'.yellow} ---- 表示使用尚未初始化版本\n  ${
      '@'.yellow
    } ---- 表未当前数据库版本\n   不传递时使用当前数据库版本`
  )
  .action(async () => {
    const opts = migrateScript.opts();
    const cli = await createMigrateCli(migrate.opts());
    try {
      await cli.script({
        target: opts.target,
        source: opts.source,
        outputPath: opts.outputPath,
      });
    } catch (error) {
      console.error(error.message.red);
      console.error(error.stack);
    } finally {
      await cli.dispose();
    }
  });

const migrateUpdate = migrate
  .command('update <target>')
  .description('更新数据库到指定版本: <target>')
  .action(async targetName => {
    const opts = migrateUpdate.opts();
    if (opts.target === '*' || opts.target === '@') {
      throw new Error(
        `错误的目标版本，为了数据安全起见，请明确指定版本名称，且不支持使用*/@指定版本。`
      );
    }
    const cli = await createMigrateCli(migrate.opts());
    try {
      await cli.update(targetName);
    } catch (error) {
      console.error(error.message.red);
      console.error(error.stack);
    } finally {
      await cli.dispose();
    }
  });

const migrateSync = migrate
  .command('sync')
  .description('同步数据库架构及种子数据')
  .action(async () => {
    const cli = await createMigrateCli(migrate.opts());
    try {
      await cli.sync();
    } catch (error) {
      console.error(error.message.red);
      console.error(error.stack);
    } finally {
      await cli.dispose();
    }
  });

Program.parse(process.argv);
