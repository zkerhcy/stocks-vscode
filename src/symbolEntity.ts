export class SymbolEntity {
  symbolName: string
  shortName: string
  price: number
  change: number
  changePct: string

  constructor(
    symbolName: string,
    shortName: string,
    price: number,
    change: number,
    changePct: string
  ) {
    this.symbolName = symbolName
    this.shortName = shortName
    this.price = price
    this.change = change
    this.changePct = changePct
  }
}
