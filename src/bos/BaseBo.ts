
import * as Decorate from "@emmveqz/currency-reports-core-interfaces/dist/Decorator"
import { IAnyObj, IBaseBo, IBaseBoFactory, IPropsNames, ISelf } from "@emmveqz/currency-reports-core-interfaces/dist/IBaseBo"

//

const getPropValByType = <T extends IBaseBo>(sampleBo: T, prop: string, val: any) => {
  if (typeof sampleBo[prop as keyof T] === typeof 1) {
    const num = Number(val)
    return isNaN(num) || isNaN( parseInt(val, 10) ) ? 0 : num
  }
  if (typeof sampleBo[prop as keyof T] === typeof true) {
    return !!val
  }

  return val
}

//

export default class BaseBo implements IBaseBo {

  public static CreateNew<T extends IBaseBo>(): T {
    return new this() as T
  }

  public static Parse<T extends IBaseBo>(bo: IAnyObj, dynProps?: IBaseBo[]): T {
    return this.CreateNew<T>().FillFrom(bo, dynProps)
  }

  public static ParseList<T extends IBaseBo>(list: IAnyObj[], dynProps?: IBaseBo[]): T[] {
    const parsedList: T[] = new Array(list.length)

    for (let i = 0; i < list.length; i++) {
      parsedList[i] = this.Parse<T>(list[i], dynProps)
    } //

    return parsedList
  }

  /**
   * Valid types:  `Array<null|string|number|boolean>`, `null`, `string`, `number`, `boolean`
   */
  public static IsPropValValid(val: any): boolean {
    const validArray = Array.isArray(val) && val.every( (v) => !Array.isArray(v) && this.IsPropValValid(v) )

    // types:  Array<null|string|number|boolean>, null, string, number, boolean
    return validArray || val === null || typeof val === typeof "" || typeof val === typeof 1 || typeof val === typeof true
  }

  /**
   * @ToDo Implement a similar one but for being used at browser, take Proto.BaseEntityEnum instead of factory.
   * @Note `factory` parameter is redundant since it's being used only for its properties detection,
   * avoiding passing the `factory` parameter can be defeated by using (statically) `this.CreateNew()`
   */
  public static getPropNames<T extends IBaseBo>(factory: IBaseBoFactory<T>): IPropsNames<T> {
    const propsNames = {} as IPropsNames<T>

    Object.keys(factory.CreateNew()).forEach((prop) => {
      (propsNames as any)[prop] = prop
    })

    return propsNames
  }

  @Decorate.Db.IsPrimaryKey
  @Decorate.Db.IsSystemProp
  @Decorate.Db.IsNonUpdatable
  @Decorate.Db.DefaultOrderBy
  public Id: number = 0

  @Decorate.Db.IsSystemProp
  @Decorate.Db.IsNonInsertable
  @Decorate.Db.IsNonUpdatable
  public CreationDate: string = ""

  @Decorate.Db.IsSystemProp
  @Decorate.Db.IsNonUpdatable
  @Decorate.Db.Mandatory
  public CreatedByUserId: number = 0

  public GetEntityName(): string {
    return this.constructor.name
  }

  public FillFrom(obj: IAnyObj, dynProps?: IBaseBo[], forceTypeCheck?: boolean): this {
    const props = Object.keys(this)
    const sampleBo = forceTypeCheck ? this.NewEmptyOrig() : undefined

    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < props.length; i++) {
      if (obj[props[i]] === undefined) {
        continue
      }

      this[props[i] as keyof this] = !sampleBo
        ? obj[props[i]]
        : getPropValByType(sampleBo, props[i], obj[props[i]])
    }
    return this
  }

  public NewEmptyOrig(): this {
    return (this.constructor as IBaseBoFactory<this>).CreateNew()
  }

  /**
   * @param nullable To comply with `google.protobuf.Struct`
   */
  public ToPlainObj(nullable?: boolean): ISelf<this> {
    const initVal = {} as ISelf<this>

    Object.keys(this).forEach((prop) => {
      initVal[prop as keyof this] = nullable && this[prop as keyof this] === undefined ? (null as any) : this[prop as keyof this]
    })

    return initVal
  }

  /**
   * Makes a copy of this object.
   * This is to avoid making a JS shallow copy hence losing the Object's constructor/type.
   */
  public copy(): this {
    const newBo = this.NewEmptyOrig()

    return newBo.FillFrom( this.ToPlainObj() )
  }

  public RemoveDecorator<P extends keyof this>(metadataKey: string, property: P): boolean {
    return Decorate.RemoveDecorator(metadataKey, this, property as string)
  }

  public OverrideDecorator(metadataKey: string, property: string, newVal: any): boolean {
    return Decorate.OverrideDecorator(metadataKey, this, property, newVal)
  }

}
