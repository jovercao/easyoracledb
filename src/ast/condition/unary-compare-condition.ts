import assert from "assert";
import { CompatibleExpression, Expression } from "../expression/expression";
import { Scalar } from "../scalar";
import { Condition, CONDITION_KIND, UNARY_COMPARE_OPERATOR } from "./condition";

/**
 * 一元比较条件
 */
 export class UnaryCompareCondition extends Condition {
  $expr: Expression<Scalar>;
  $operator: UNARY_COMPARE_OPERATOR;
  $kind: CONDITION_KIND.UNARY_COMPARE = CONDITION_KIND.UNARY_COMPARE;

  /**
   * 一元比较运算符
   * @param operator 运算符
   * @param expr 查询条件
   */
  constructor(
    operator: UNARY_COMPARE_OPERATOR,
    expr: CompatibleExpression<Scalar>
  ) {
    super();
    this.$operator = operator;
    assert(expr, 'next must not null');
    this.$expr = Expression.ensure(expr);
  }

  static isUnaryCompareCondition(object: any): object is UnaryCompareCondition {
    return Condition.isCondition(object) && object.$kind === CONDITION_KIND.UNARY_COMPARE
  }

  /**
 * 比较运算 IS NULL
 * @returns 返回比较运算符
 * @param expr 表达式
 */
    static isNull(expr: CompatibleExpression<Scalar>): Condition {
    return new UnaryCompareCondition(UNARY_COMPARE_OPERATOR.IS_NULL, expr);
  }
  /**
   * 比较运算 IS NOT NULL
   * @param expr 表达式
   * @returns 返回比较运算符
   */
  static isNotNull(expr: CompatibleExpression<Scalar>): Condition {
    return new UnaryCompareCondition(UNARY_COMPARE_OPERATOR.IS_NOT_NULL, expr);
  }
}
