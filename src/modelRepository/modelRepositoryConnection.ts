// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { createHmac, Hmac } from "crypto";
import { Constants } from "../common/constants";

const PROPERTY_SEPARATOR = ";";
const KEY_VALUE_SEPARATOR = "=";
const PROPERTY_COUNT = 4;
const HOSTNAME_PROPERTY = "HostName";
const REPOSITORY_ID_PROPERTY = "RepositoryId";
const SHARED_ACCESS_KEY_NAME_PROPERTY = "SharedAccessKeyName";
const SHARED_ACCESS_KEY_PROPERTY = "SharedAccessKey";
const HOSTNAME_REGEX = new RegExp("[a-zA-Z0-9_\\-\\.]+$");
const SHARED_ACCESS_KEY_NAME_REGEX = new RegExp("^[a-zA-Z0-9_\\-@\\.]+$");
const BASE64 = "base64";
const SHA256 = "sha256";
const MILLISECONDS = 1000;
const EXPIRY_IN_MINUTES = 30;
const SECONDS_PER_MINUTE = 60;

/**
 * Model repository connection
 */
export class ModelRepositoryConnection {
  /**
   * parse connection string, validate and return model repository connection
   * @param connectionString connection string
   */
  public static parse(connectionString: string): ModelRepositoryConnection {
    if (!connectionString) {
      throw new Error(`Connection string ${Constants.NOT_EMPTY_MSG}`);
    }
    const map: { [key: string]: string } = {};
    const properties: string[] = connectionString.split(PROPERTY_SEPARATOR);
    if (properties.length !== PROPERTY_COUNT) {
      throw new Error(Constants.CONNECTION_STRING_INVALID_FORMAT_MSG);
    }
    for (const property of properties) {
      const index: number = property.indexOf(KEY_VALUE_SEPARATOR);
      if (index <= 0) {
        throw new Error(Constants.CONNECTION_STRING_INVALID_FORMAT_MSG);
      }
      const name: string = property.slice(0, index);
      const value: string = property.slice(index + 1);
      if (!name || !value) {
        throw new Error(Constants.CONNECTION_STRING_INVALID_FORMAT_MSG);
      }
      map[name] = value;
    }
    // validate connection
    const connection = new ModelRepositoryConnection(
      map[HOSTNAME_PROPERTY],
      map[REPOSITORY_ID_PROPERTY],
      map[SHARED_ACCESS_KEY_NAME_PROPERTY],
      map[SHARED_ACCESS_KEY_PROPERTY],
    );
    connection.validate();
    return connection;
  }

  private readonly expiry: string;
  private constructor(
    public readonly hostName: string,
    public readonly repositoryId: string,
    public readonly sharedAccessKeyName: string,
    public readonly sharedAccessKey: string,
  ) {
    const now: number = new Date().getTime();
    this.expiry = (Math.round(now / MILLISECONDS) + EXPIRY_IN_MINUTES * SECONDS_PER_MINUTE).toString();
  }

  /**
   * generate access token
   */
  public generateAccessToken(): string {
    const endpoint: string = encodeURIComponent(this.hostName);
    const payload: string = [encodeURIComponent(this.repositoryId), endpoint, this.expiry].join("\n").toLowerCase();
    const signature: Buffer = Buffer.from(payload, Constants.UTF8);
    const secret: Buffer = Buffer.from(this.sharedAccessKey, BASE64);
    const hmac: Hmac = createHmac(SHA256, secret);
    hmac.update(signature);
    const hash: string = encodeURIComponent(hmac.digest(BASE64));
    return (
      "SharedAccessSignature " +
      `sr=${endpoint}&sig=${hash}&se=${this.expiry}&skn=${this.sharedAccessKeyName}&rid=${this.repositoryId}`
    );
  }

  /**
   * validate model repository connection
   */
  private validate(): void {
    if (!this.hostName || !HOSTNAME_REGEX.test(this.hostName)) {
      throw new Error(`${Constants.CONNECTION_STRING_INVALID_FORMAT_MSG} on property ${HOSTNAME_PROPERTY}`);
    }
    if (!this.repositoryId) {
      throw new Error(`${Constants.CONNECTION_STRING_INVALID_FORMAT_MSG} on property ${REPOSITORY_ID_PROPERTY}`);
    }
    if (!this.sharedAccessKeyName || !SHARED_ACCESS_KEY_NAME_REGEX.test(this.sharedAccessKeyName)) {
      throw new Error(
        `${Constants.CONNECTION_STRING_INVALID_FORMAT_MSG} on property ${SHARED_ACCESS_KEY_NAME_PROPERTY}`,
      );
    }
    if (!this.sharedAccessKey) {
      throw new Error(`${Constants.CONNECTION_STRING_INVALID_FORMAT_MSG} on property ${SHARED_ACCESS_KEY_PROPERTY}`);
    }
  }
}