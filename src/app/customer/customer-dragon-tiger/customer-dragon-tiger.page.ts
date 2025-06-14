import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonModal } from '@ionic/angular';
import { FirebaseHelperService } from 'src/app/share/data-access/firebase-helper.service';

@Component({
  selector: 'app-customer-dragon-tiger',
  templateUrl: './customer-dragon-tiger.page.html',
  styleUrls: ['./customer-dragon-tiger.page.scss'],
})
export class CustomerDragonTigerPage implements OnInit {
  @ViewChild(IonModal) modal!: IonModal;

  userInput!: string;
  // userInput = 'R';
  lastA1Predicton = '';
  actualOutcomes: any[] = [];
  displayOutcomes: any[] = [];
  predictions: any[] = [];
  patterns: any[] = [];
  nextOutcome: any;
  token = 0;
  attackTokens = [4, 2, 3, 4, 5, 6, 8, 10];
  retrenchTokens = [4, 6, 10, 16, 26, 40, 60];
  tokenStrategy = '';
  accumulatedWinLoss = 0;
  tokenHistory: any = [];
  tokenIndex = 0;
  consecutiveCorrects = true;

  lastWinPrediction = '';
  winCount = 0;
  looseCount = 0;

  constructor(
    private _router: Router,
    private _firebaseService: FirebaseHelperService,
    private route: ActivatedRoute
  ) {
    // this.checkSession();
    route.params.subscribe((val) => {
      console.log('Here...');
      this.reset();
    });
  }

  ngOnInit() {}

  checkSession() {
    // this.checkUserExpiry();
    let userId = localStorage.getItem('UID');
    // if(localStorage.getItem('UID'))
    console.log(userId);
    if (!userId) {
      return;
      // TODO: temporary for testing
      this._router.navigateByUrl('/login');
    }
  }

  openModal() {}

  dismiss() {
    this.modal.dismiss();
  }

  undoInput() {}

  onSelectInput(input: string) {
    this.userInput = input;
    console.log('==>', this.userInput);
  }

  async startGame() {
    this.dismiss();
    this.reset();
    const isExpired = await this._firebaseService.checkExpiry();
    if (isExpired) {
      localStorage.clear();
      alert(
        'It looks like your account has been expired. Please contact admin to renew and activate your account!'
      );
      this._router.navigateByUrl('/');
      return;
    }

    // Prediction for A-1
    if (this.userInput === 'R') {
      this.nextOutcome = 'R';
    } else if (this.userInput === 'B') {
      this.nextOutcome = 'B';
    }

    this.actualOutcomes = [];
    this.displayOutcomes = [];

    this.predictions = ['-'];
    this.patterns = ['-'];
    this.actualOutcomes.push(this.userInput);
    this.displayOutcomes.push(this.userInput);

    this.predictions.push(this.nextOutcome);
    this.patterns.push('S');

    this.tokenHistory = [];

    this.token = 4;
    // this.tokenIndex++;
    // this.accumulatedWinLoss += this.token;
    this.tokenHistory.push(this.token);
    this.tokenStrategy = 'ATTACK';
    // --------
    this.lastA1Predicton = this.nextOutcome;
    this.winCount = 0;
    this.looseCount = 0;
  }

  setInput(value: any) {
    if (this.token) {
      this.actualOutcomes.push(value);
      this.displayOutcomes.push(value);
      this.predictNextOutcome();
    } else {
      alert('Please click on start to start the prediction!');
    }
  }

  predictNextOutcome() {
    let actualOutcomesLength = this.actualOutcomes.length;
    let predictionLength = this.actualOutcomes.length;

    // console.log(actualOutcomesLength);

    let lastOutcome = this.actualOutcomes[actualOutcomesLength - 1];
    let lastprediction = this.predictions[predictionLength - 1];
    let lastPatternUsed = this.patterns[predictionLength - 1];
    // console.log('Last = ', lastOutcome);
    // console.log('Last Pattern = ', lastPatternUsed);

    // if (actualOutcomesLength === 2) {
    // }

    // Prediction for "A1"
    console.log('Current WIN Count = ', this.winCount);
    console.log('Current LOOSE Count = ', this.looseCount);
    // if (lastPatternUsed === 'A1') {
    // For WIN
    if (lastprediction === lastOutcome) {
      this.winCount++;
      this.looseCount = 0;
      this.lastWinPrediction = lastOutcome;
      if (lastPatternUsed === 'S') {
        // Continuing the same wager if we WIN
        this.nextOutcome = lastOutcome;
        this.patterns.push('S');
      } else {
        if (lastOutcome === 'B') {
          this.nextOutcome = 'R';
        } else if (lastOutcome === 'R') {
          this.nextOutcome = 'B';
        }
        this.patterns.push('O');
      }
    } else {
      // For LOOSE
      this.looseCount++;
      this.winCount = 0;
      if (this.looseCount < 2) {
        this.patterns.push('S');
        this.nextOutcome = lastOutcome;
      } else {
        if (this.looseCount === 2) {
          this.patterns.push('O');
          if (lastOutcome === 'R') {
            this.nextOutcome = 'B';
          } else {
            this.nextOutcome = 'R';
          }
        } else {
          this.patterns.push('S');
          this.looseCount = 1;
          this.nextOutcome = lastOutcome;
        }
      }
      // this.patterns.push('A2');
    }
    // }

    // console.log('Next Outcome =', this.nextOutcome);
    this.predictions.push(this.nextOutcome);

    // BEGINS - Setting the token value
    // For Correct cases
    if (lastprediction === lastOutcome) {
      this.accumulatedWinLoss += this.token;

      if (this.tokenStrategy === 'RETRENCH') {
        // If we are correct at initial retrench
        if (this.tokenIndex === 0) {
          this.tokenStrategy = 'ATTACK';
          this.tokenIndex = 0;
          this.token = this.attackTokens[this.tokenIndex];
        } else {
          // Two Consecutive Corrects in "RETRENCH"
          if (
            this.predictions[predictionLength - 2] ===
              this.actualOutcomes[actualOutcomesLength - 2] &&
            this.consecutiveCorrects
          ) {
            this.consecutiveCorrects = false;
            if (this.tokenIndex > 1) {
              this.tokenIndex -= 2;
              this.token = this.retrenchTokens[this.tokenIndex];
            } else {
              this.tokenStrategy = 'ATTACK';
              this.tokenIndex = 0;
              this.token = this.attackTokens[this.tokenIndex];
            }
          } else {
            this.consecutiveCorrects = true;
            if (this.tokenIndex > 0) {
              this.tokenIndex--;
            }
            this.token = this.retrenchTokens[this.tokenIndex];
          }
        }
      } else {
        if (this.tokenIndex < 7) {
          this.tokenIndex++;
        }
        this.token = this.attackTokens[this.tokenIndex];
      }

      console.log('Token Index = ', this.tokenIndex);
    }

    // For Incorrect cases
    else {
      this.accumulatedWinLoss -= this.token;

      if (this.tokenStrategy === 'ATTACK') {
        this.tokenStrategy = 'RETRENCH';
        this.tokenIndex = 0;
        this.token = this.retrenchTokens[this.tokenIndex];
      } else {
        // Reset to initital retrench if accumulated tokens are below -150
        if (this.accumulatedWinLoss <= -150 && this.tokenIndex > 5) {
          this.tokenIndex = -1;
        }
        if (this.tokenIndex < 6) {
          this.tokenIndex++;
        }
        this.token = this.retrenchTokens[this.tokenIndex];
      }
    }

    this.tokenHistory.push(this.token);
    // ENDS - Setting the token value
  }

  houseWin() {
    this.displayOutcomes.push('T');
  }

  reset() {
    this.actualOutcomes = [];
    this.displayOutcomes = [];
    this.predictions = [];
    this.nextOutcome = null;
    this.token = 0;
    this.tokenHistory = [];
    this.accumulatedWinLoss = 0;
    // console.log(this.actualOutcomes);
  }

  // async checkUserExpiry() {

  //   console.log('Is Expired = ', isExpired);

  //   // TODO: Temporary
  //   // if (isExpired) {
  //   //   this._router.navigateByUrl('/');
  //   //   localStorage.clear();
  //   // }
  // }
}
