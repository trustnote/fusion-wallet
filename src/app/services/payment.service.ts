import { Injectable } from '@angular/core';
import { ModalController, Events } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

import { NGXLogger } from 'ngx-logger';
import { NetworkService } from './network.service';
import { WalletService } from './wallet.service';
import { ProfileService } from './profile.service';
import { TipsService } from './tips.service';

import { PaymentPage } from '../modal/payment/payment.page';

import { modalAlertEnter, modalAlertLeave } from '../modal/modal.style';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  constructor(
    public events: Events,
    private modalController: ModalController,
    private translate: TranslateService,
    private logger: NGXLogger,
    private networkService: NetworkService,
    private walletService: WalletService,
    private profileService: ProfileService,
    private tipsService: TipsService
  ) {
    this.events.subscribe('payment', (address, amount, asset, msg) => {
      this.logger.debug('evnets: payment', address, amount, asset, msg);
      this.paySingleAddress(address, amount, asset, msg);
    });
  }

  pay(outputs, asset, message) {
    return new Promise((resolve, reject) => {
      let transData = {
        asset: asset,
        message: message,
        payer: this.profileService.wallet.address,
        outputs: outputs
      };

      this.networkService.transfer(transData).subscribe(
        response => {
          this.logger.debug(response);
          if (!response.data) {
            reject(response.errMsg);
            return;
          }
          let textToSign = response.data.b64_to_sign;
          let txid = response.data.txid;

          this.walletService
            .sign(textToSign, this.profileService.wallet.privkey)
            .then(sig => {
              let sigData = {
                txid: txid,
                sig: sig
              };
              this.logger.debug('sign result: ', sigData);
              this.networkService.submitSig(sigData).subscribe(
                res => {
                  if (!res.data) {
                    reject(res.errMsg);
                    return;
                  }
                  this.logger.debug('payment result:', res);
                  this.events.publish('payment_success', res.data.unit);
                  resolve(res);
                },
                error => {
                  reject(error);
                  return;
                }
              );
            })
            .catch(err => {
              reject(err);
              return;
            });
        },
        error => {
          reject(error);
          return;
        }
      );
    });
  }

  async paySingleAddress(address, amount, asset, message) {
    let outputs = [
      {
        address: address,
        amount: amount
      }
    ];

    try {
      this.tipsService.loading();
      let ret = await this.pay(outputs, asset, message);
      this.logger.debug(ret);
      this.tipsService.alert(this.translate.instant('Success'), null);
    } catch (error) {
      // TODO: 处理失败翻译
      if (error.match('not enough asset')) {
        error = this.translate.instant('Not enough assets');
      }
      this.tipsService.alert(this.translate.instant('Failed'), error);
      this.logger.error(error);
    }
  }

  async confirmPay(address, amount, asset, msg) {
    const modal = await this.modalController.create({
      component: PaymentPage,
      enterAnimation: modalAlertEnter,
      leaveAnimation: modalAlertLeave,
      showBackdrop: true,
      backdropDismiss: true,
      componentProps: {
        paymentInfo: {
          address: address,
          amount: amount,
          asset: asset,
          message: msg
        }
      }
    });
    return await modal.present();
  }

  // payMutiAddress()
}
