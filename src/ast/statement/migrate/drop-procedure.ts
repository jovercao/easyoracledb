import { CompatiableObjectName } from "../../object/db-object";
import { Statement, STATEMENT_KIND } from "../statement";

export class DropProcedure<N extends string = string> extends Statement {
  static isDropProcedure(object: any): object is DropProcedure {
    return Statement.isStatement(object) && object.$kind === STATEMENT_KIND.DROP_PROCEDURE;
  }
  $kind: STATEMENT_KIND.DROP_PROCEDURE = STATEMENT_KIND.DROP_PROCEDURE;
  $name: CompatiableObjectName<N>;

  constructor(name: CompatiableObjectName<N>) {
    super();
    this.$name = name;
  }
}
