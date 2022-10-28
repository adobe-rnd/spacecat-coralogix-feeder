/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import path from 'path';
import { Request, Response } from '@adobe/fetch';
import { hostname } from 'os';
import { fetch } from './support/utils.js';

const LOG_LEVEL_MAPPING = {
  ERROR: 5,
  WARN: 4,
  INFO: 3,
  VERBOSE: 2,
  DEBUG: 1,
  TRACE: 1,
  SILLY: 1,
};

export class CoralogixLogger {
  constructor(apiKey, logGroup, opts = {}) {
    const {
      host = hostname(),
      apiUrl = 'https://api.coralogix.com/api/v1/',
    } = opts;

    this._apiKey = apiKey;
    this._host = host;
    this._apiUrl = apiUrl;

    const [,,, longFuncName] = logGroup.split('/');
    [this._subsystem, this._funcName] = longFuncName.split('--');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async sendEntries(entries) {
    const logEntries = entries.map(({ timestamp, extractedFields }) => {
      const [level, message] = extractedFields.event.split('\t');
      return {
        timestamp,
        text: JSON.stringify({
          inv: {
            functionName: this._funcName,
            requestId: extractedFields.request_id || 'n/a',
            message,
          },
        }),
        severity: LOG_LEVEL_MAPPING[level] || 3,
      };
    });
    const body = {
      privateKey: this._apiKey,
      applicationName: this._host,
      subsystemName: this._subsystem,
      computerName: this._host,
      logEntries,
    };
    try {
      return fetch(new Request(path.join(this._apiUrl, '/logs'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }));
    } catch (e) {
      return new Response(e.message, {
        status: 500,
        headers: {
          'content-type': 'text/plain',
          'cache-control': 'no-store, private, must-revalidate',
        },
      });
    }
  }
}
