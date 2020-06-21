import * as vscode from 'vscode'
import * as https from 'https'
import * as iconv from 'iconv-lite'
import { SymbolEntity } from './symbolEntity'

const API_URL: string = 'https://hq.sinajs.cn/format=text&list='
const confProps = {
  ENABLE: 'stocks.enable',
  REFRESH_INTERVAL: 'stocks.refreshInterval',
  LOOP_INTERVAL: 'stocks.loopInterval',
  POSITIVE_COLOR: 'stocks.positiveColor',
  SHOW_PERCENTAGE: 'stocks.showPercentage',
  SYMBOLS: 'stocks.symbols'
}
let refreshInterval = 60 * 1e3
let loopInterval = 3 * 1e3
let refreshIntervalId: NodeJS.Timeout
let loopIntervalId: NodeJS.Timeout
const symbolColors: { [key: string]: string } = {
  red: '#EB4D3D',
  green: '#76D572',
  default: '#A2A7A7'
}
let statusBarEntities: SymbolEntity[]
let statusBarInstance: vscode.StatusBarItem

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration()
  statusBarEntities = []

  refresh()
  refreshInterval = config.get<number>(confProps.REFRESH_INTERVAL, 60) * 1e3
  refreshIntervalId = setInterval(refresh, refreshInterval)
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(refresh))
}

export function deactivate() {
  clear()
}

function refresh(): void {
  const config = vscode.workspace.getConfiguration()
  const enable = config.get<boolean>(confProps.ENABLE, false)
  const configuredSymbols = config.get<Array<string>>(confProps.SYMBOLS, [])
  clearInterval(loopIntervalId)
  if (enable && configuredSymbols.length) {
    console.log('refreshSymbols', new Date())
    create()
    refreshSymbols(configuredSymbols)
  }
}

function clear(): void {
  clearInterval(loopIntervalId)
  clearInterval(refreshIntervalId)
}

function create(): void {
  if (!statusBarInstance) {
    statusBarInstance = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    )
    statusBarInstance.text = `--: …`
  }
  statusBarInstance.show()
}

async function refreshSymbols(symbols: string[]): Promise<void> {
  const s_symbols = symbols.map(o => `s_${o}`)
  const url = `${API_URL}${s_symbols.join(',')}`
  try {
    const resp = await fetchData(url)
    statusBarEntities = []
    resp.split('\n').forEach(o => {
      if (o) {
        const tmpArr = o.split(',')
        const symbolName = tmpArr[0].split('=')[0].substring(2)
        const shortName = tmpArr[0].split('=')[1]
        statusBarEntities.push(
          new SymbolEntity(
            symbolName,
            shortName,
            parseFloat(parseFloat(tmpArr[1]).toFixed(3)),
            parseFloat(parseFloat(tmpArr[2]).toFixed(3)),
            tmpArr[3]
          )
        )
      }
    })
    showNext()
  } catch (e) {
    throw new Error(`Invalid response: ${e.message}`)
  }
}

function showNext(i = 0) {
  const config = vscode.workspace.getConfiguration()
  loopInterval = config.get<number>(confProps.LOOP_INTERVAL, 3) * 1e3
  loopIntervalId = setTimeout(
    (function(num) {
      return () => {
        updateItemWithSymbolQuote(
          statusBarEntities[num % statusBarEntities.length]
        )
        showNext(++num)
      }
    })(i),
    loopInterval
  )
}

function updateItemWithSymbolQuote(entity: SymbolEntity) {
  const config = vscode.workspace.getConfiguration()
  if (!statusBarInstance) {
    return
  }

  const price = entity.price
  const changePrefix = `${entity.change > 0 ? '+' : ''}`
  let change = `${changePrefix}${entity.change}`
  if (config.get<boolean>(confProps.SHOW_PERCENTAGE, false)) {
    change = `${changePrefix}${entity.changePct}%`
  }
  statusBarInstance.text = `${entity.shortName} ${price}(${change})`

  const positiveColor = config.get<string>(confProps.POSITIVE_COLOR, 'red')
  const nagtiveColor = positiveColor === 'red' ? 'green' : 'red'
  let color = symbolColors.default
  if (entity.change !== 0) {
    color =
      entity.change > 0
        ? symbolColors[positiveColor]
        : symbolColors[nagtiveColor]
  }
  statusBarInstance.color = color
}

function fetchData(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, resp => {
      let chunks: Array<Buffer> = []
      resp.on('data', chunk => chunks.push(chunk))
      resp.on('end', () => {
        if (resp.statusCode === 200) {
          const contentType: String = resp.headers['content-type'] || ''
          const matchCharset = contentType.match(/(?:charset=)(\w+)/) || []
          const body = iconv.decode(
            Buffer.concat(chunks),
            matchCharset[1] || 'utf8'
          )
          console.log('response:', body)
          resolve(body)
        } else {
          reject(`request fail: ${resp.statusCode} - ${resp.statusMessage}`)
        }
      })
    })
  })
}
