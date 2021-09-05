import { SQL, SQL_SYMBOLE } from "../../sql";
import { DbType } from "../../db-type";
import { Literal } from "../../expression/literal";
import { PARAMETER_DIRECTION } from "../../expression/parameter";

export class ProcedureParameter extends SQL {
  readonly $type: SQL_SYMBOLE.PROCEDURE_PARAMETER =
    SQL_SYMBOLE.PROCEDURE_PARAMETER;

  constructor(
    name: string,
    dataType: DbType,
    direct: PARAMETER_DIRECTION = 'INPUT'
  ) {
    super();
    this.$name = name;
    this.$dbType = dataType;
    this.$direct = direct;
  }

  $name: string;
  $dbType: DbType;
  $direct: PARAMETER_DIRECTION;
  $default?: Literal;
}
