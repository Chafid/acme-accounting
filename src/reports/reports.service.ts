import { Injectable } from '@nestjs/common';
import { promises as fsp } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

@Injectable()
export class ReportsService {
  private states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };

  private parsedFiles: Record<string, string[][]> = {};

  state(scope: keyof typeof this.states): string {
    return this.states[scope];
  }

  /** Simulate processing large files (for demo purposes only)
   */
  /*private async simulateWork(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }*/

  /**
   * Load and cache CSV files into memory once (async version)
   */
  private async loadFiles() {
    const tmpDir = 'tmp';
    this.parsedFiles = {};

    const files = await fsp.readdir(tmpDir);

    await Promise.all(
      files
        .filter((file) => file.endsWith('.csv'))
        .map(async (file) => {
          const content = await fsp.readFile(path.join(tmpDir, file), 'utf-8');
          const lines = content
            .trim()
            .split('\n')
            .map((line) => line.split(','));
          this.parsedFiles[file] = lines;
        }),
    );
  }

  /**
   * ReportsService handles generation of multiple CSV reports.
   *
   * Observations and improvements:
   * 1. Originally, CSV files were read each time the report methods were called.
   * 2. Updated to read files once and store them in memory; report methods now use this cached data.
   * 3. Applied ChatGPT suggestion to run accounts(), yearly(), and fs() in parallel using Promise.all
   *    instead of sequentially, further optimizing performance.
   * 4. Each report method updates its own state to reflect progress.
   * 5. Simulated processing time code is commented out but can be used for testing.
   * 6. Overall, these changes significantly improve efficiency and responsiveness.
   * 7. Note: In a real-world scenario, consider memory usage when caching large files.
   *    For very large datasets, a streaming approach might be more appropriate.
   */

  // new method to generate all reports in parallel
  async generateAllReports() {
    await this.loadFiles(); //
    await Promise.all([this.accounts(), this.yearly(), this.fs()]);
  }

  private async accounts() {
    this.states.accounts = 'starting';
    const start = performance.now();

    // simulate processing time
    //await this.simulateWork(3000);

    const outputFile = 'out/accounts.csv';
    const accountBalances: Record<string, number> = {};

    for (const lines of Object.values(this.parsedFiles)) {
      for (const line of lines) {
        const [, account, , debit, credit] = line;
        if (!accountBalances[account]) {
          accountBalances[account] = 0;
        }
        accountBalances[account] +=
          parseFloat(debit || '0') - parseFloat(credit || '0');
      }
    }

    const output = ['Account,Balance'];
    for (const [account, balance] of Object.entries(accountBalances)) {
      output.push(`${account},${balance.toFixed(2)}`);
    }

    await fsp.writeFile(outputFile, output.join('\n'));

    this.states.accounts = `finished in ${(
      (performance.now() - start) /
      1000
    ).toFixed(2)}`;
  }

  async yearly() {
    this.states.yearly = 'starting';
    const start = performance.now();

    // simulate processing time
    //await this.simulateWork(3000);

    const outputFile = 'out/yearly.csv';
    const cashByYear: Record<string, number> = {};

    for (const [file, lines] of Object.entries(this.parsedFiles)) {
      if (file !== 'yearly.csv') {
        for (const line of lines) {
          const [date, account, , debit, credit] = line;
          if (account === 'Cash') {
            const year = new Date(date).getFullYear();
            if (!cashByYear[year]) {
              cashByYear[year] = 0;
            }
            cashByYear[year] +=
              parseFloat(debit || '0') - parseFloat(credit || '0');
          }
        }
      }
    }

    const output = ['Financial Year,Cash Balance'];
    Object.keys(cashByYear)
      .sort()
      .forEach((year) => {
        output.push(`${year},${cashByYear[year].toFixed(2)}`);
      });
    await fsp.writeFile(outputFile, output.join('\n'));

    this.states.yearly = `finished in ${(
      (performance.now() - start) /
      1000
    ).toFixed(2)}`;
  }

  private async fs() {
    this.states.fs = 'starting';
    const start = performance.now();

    // simulate processing time
    //await this.simulateWork(3000);

    const outputFile = 'out/fs.csv';
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };

    const balances: Record<string, number> = {};
    for (const section of Object.values(categories)) {
      for (const group of Object.values(section)) {
        for (const account of group) {
          balances[account] = 0;
        }
      }
    }

    for (const [file, lines] of Object.entries(this.parsedFiles)) {
      if (file !== 'fs.csv') {
        for (const line of lines) {
          const [, account, , debit, credit] = line;
          if (Object.hasOwn(balances, account)) {
            balances[account] +=
              parseFloat(debit || '0') - parseFloat(credit || '0');
          }
        }
      }
    }

    const output: string[] = [];
    output.push('Basic Financial Statement', '', 'Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of categories['Income Statement']['Revenues']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of categories['Income Statement']['Expenses']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(
      `Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`,
      '',
      'Balance Sheet',
    );
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`, '', 'Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(
      `Total Liabilities,${totalLiabilities.toFixed(2)}`,
      '',
      'Equity',
    );
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(
        2,
      )}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`, '');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(
        totalLiabilities + totalEquity
      ).toFixed(2)}`,
    );
    await fsp.writeFile(outputFile, output.join('\n'));

    this.states.fs = `finished in ${(
      (performance.now() - start) /
      1000
    ).toFixed(2)}`;
  }
}
