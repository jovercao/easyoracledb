const lube = require('../index')
const assert = require('power-assert')
const mock = require('mockjs')
const _ = require('lodash')

describe.only('MSSQL数据库测试', function () {
  this.timeout(0)
  let pool

  const dbConfig = {
    dialect: 'mssql',
    user: 'sa',
    password: '!crgd-2019',
    host: 'jover.wicp.net',
    // instance: 'MSSQLSERVER',
    database: 'TEST',
    port: 1433,
    // 最小值
    poolMin: 0,
    // 最大值
    poolMax: 5,
    // 闲置连接关闭等待时间
    idelTimeout: 30000,
    // 连接超时时间
    connectTimeout: 15000,
    // 请求超时时间
    requestTimeout: 15000
  }

  before(async function() {
    pool = await lube.connect(dbConfig)
    // pool.on('command', cmd => {
    //   console.log(cmd)
    // })
  })

  after(async function() {
    pool.close()
  })

  it('create table', async function () {
    const createTable = `create table Items (
      FId INT PRIMARY KEY,
      FName NVARCHAR(120),
      FAge INT,
      FSex BIT,
      FCreateDate DATETIME
    )`
    await pool.query(createTable)
    // console.dir(rs)
  })

  it('query', async function() {
    const rs1 = await pool.query('select [Name] = @p1, [Age] = @p2', {
      p1: 'name',
      p2: '100'
    })
    assert(rs1.rows[0].Name === 'name')

    const name = 'Jover'
    const rs2 = await pool.query`select [Name] = ${name}, [Age] = ${19}`
    assert(rs2.rows[0].Name === name)
  })

  it('insert', async function () {
    const { rows } = mock.mock({
      // 属性  的值是一个数组，其中含有 1 到 10 个元素
      'rows|1-50': [{
        // 属性 id 是一个自增数，起始值为 1，每次增 1
        'FID|+1': 1,
        'FAge|18-60': 1,
        'FSex|0-1': false,
        FName: '@name',
        FCreateDate: new Date()
      }]
    })

    const lines = await pool.insert('Items', rows)
    assert(lines === rows.length)
  })

  it('find', async function () {
    const item = await pool.find('Items', {
      FID: 1
    })
    assert(item)
  })

  it('update', async function () {
    const lines = await pool.update('Items', {
      FNAME: '冷蒙',
      FAGE: 21,
      FSEX: false
    }, {
      FID: 1
    })
    assert(lines === 1)
  })

  it('select', async function () {
    const $ = lube.Condition.field
    const $not = lube.Condition.not

    const where = $('FID').eq(1)
      .and($('FID').uneq(0))
      .and($('FID').in([0, 1, 2, 3]))
      .and(
        $('FNAME').like('%冷%')
          .or($('FID').eq(1))
          .or($('FID').gt(1))
          .or($('FID').lte(1))
          .or($('FID').gte(1))
          .or($('FNAME').notnull())
          .or($('FID').in([1, 2, 3]))
          .or($('FID').notin([1, 2, 3]))
          .or($('FID').notnull())
      )
      .and(
        $('FID').eq(1)
          .and($('FNAME').eq('冷蒙'))
          .and($('FID').in(1, 2, 3, 4))
      )

    const rows = await pool.select('Items', {
      where,
      offset: 0,
      limit: 1
    })
    assert(rows.length === 1)
    assert(rows[0].FName === '冷蒙')
    assert(rows[0].FSex === false)
  })

  it('select all', async () => {
    const rows = await pool.select('Items')
    assert(_.isArray(rows))
  })

  it('trans -> rollback', async () => {
    pool.trans(async (executor, abort) => {
      const lines = await executor.delete('Items')
      assert(lines > 0)
      await abort()
    })

    const rows = await pool.select('Items')
    assert(rows.length > 0)
  })

  it('trans -> commit', async () => {
    await pool.trans(async (executor, cancel) => {
      const lines = await executor.insert('Items', {
        FId: 1024,
        FName: '添加测试',
        FSex: false,
        FAge: 18
      })
      assert(lines > 0)
      await cancel()
    })

    const rows = await pool.select('Items')
    assert(rows.length > 0)
  })

  it('delete', async function () {
    const lines = await pool.delete('Items')
    assert(lines >= 1)
  })

  it('drop table', async function() {
    await pool.query('drop table Items')
  })
})