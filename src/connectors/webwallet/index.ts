import type {
  AccountChangeEventHandler,
  StarknetWindowObject,
} from "get-starknet-core"
import type { AccountInterface } from "starknet"
import { Connector, type ConnectorIcons } from "../connector"
import { setPopupOptions, trpcProxyClient } from "./helpers/trpc"

import {
  ConnectorNotConnectedError,
  ConnectorNotFoundError,
  UserNotConnectedError,
  UserRejectedRequestError,
} from "../../errors"
import { DEFAULT_WEBWALLET_URL } from "./constants"
import { getWebWalletStarknetObject } from "./starknetWindowObject/getWebWalletStarknetObject"

let _wallet: StarknetWindowObject | null = null

interface WebWalletConnectorOptions {
  url?: string
}

export class WebWalletConnector extends Connector {
  private _wallet: StarknetWindowObject | null = null
  private _options: WebWalletConnectorOptions

  constructor(options: WebWalletConnectorOptions = {}) {
    super()
    this._options = options
  }

  available(): boolean {
    return true
  }

  async ready(): Promise<boolean> {
    if (!_wallet) {
      this._wallet = null
      return false
    }

    this._wallet = _wallet
    return this._wallet.isPreauthorized()
  }

  get id(): string {
    this._wallet = _wallet
    return this._wallet?.id || "argentWebWallet"
  }

  get name(): string {
    this._wallet = _wallet
    return this._wallet?.name || "Argent Web Wallet"
  }

  get icon(): ConnectorIcons {
    return {
      light: DEFAULT_WEBWALLET_URL,
      dark: DEFAULT_WEBWALLET_URL,
    }
  }

  get wallet(): StarknetWindowObject {
    if (!this._wallet) {
      throw new ConnectorNotConnectedError()
    }
    return this._wallet
  }

  get title(): string {
    return "Email"
  }

  get subtitle(): string {
    return "Powered by Argent"
  }

  async connect(): Promise<AccountInterface> {
    await this.ensureWallet()

    if (!this._wallet) {
      throw new ConnectorNotFoundError()
    }

    try {
      await this._wallet.enable({ starknetVersion: "v4" })
    } catch {
      // NOTE: Argent v3.0.0 swallows the `.enable` call on reject, so this won't get hit.
      throw new UserRejectedRequestError()
    }

    if (!this._wallet.isConnected) {
      throw new UserRejectedRequestError()
    }

    return this._wallet.account as unknown as AccountInterface
  }

  async disconnect(): Promise<void> {
    if (!this.available() && !this._wallet) {
      throw new ConnectorNotFoundError()
    }

    if (!this._wallet?.isConnected) {
      throw new UserNotConnectedError()
    }
    _wallet = null
    this._wallet = _wallet
  }

  /* 
    Don't throw an exception if the wallet is not connected. 
    This is needed because when argentMobile and webwallet connectors are used together with starknet-react, 
    it would always try to retrieve the account since the connectors are always available (and throw an exception since the value is null)

    https://github.com/apibara/starknet-react/blob/226e4cb1d8e9b478dc57d45a98a59a57733572bb/packages/core/src/hooks/useAccount.ts#L92
    
   */
  async account(): Promise<AccountInterface | null> {
    this._wallet = _wallet

    if (!this._wallet || !this._wallet.account) {
      return null
    }

    return this._wallet.account as unknown as AccountInterface
  }

  async initEventListener(accountChangeCb: AccountChangeEventHandler) {
    this._wallet = _wallet
    if (!this._wallet) {
      throw new ConnectorNotConnectedError()
    }

    this._wallet.on("accountsChanged", accountChangeCb)
  }

  async removeEventListener(accountChangeCb: AccountChangeEventHandler) {
    this._wallet = _wallet
    if (!this._wallet) {
      throw new ConnectorNotConnectedError()
    }

    this._wallet.off("accountsChanged", accountChangeCb)

    _wallet = null
    this._wallet = null
  }

  private async ensureWallet(): Promise<void> {
    const origin = this._options.url || DEFAULT_WEBWALLET_URL
    setPopupOptions({
      origin,
      location: "/interstitialLogin",
    })
    const wallet = await getWebWalletStarknetObject(origin, trpcProxyClient({}))

    _wallet = wallet ?? null
    this._wallet = _wallet
  }
}
