

import { browser, protractor } from "protractor";
import {logger} from "../utils";

export class LoginPage {
    async open() {
        logger.debug("Opening login page");
        await browser.get(this.getPath());
        return new LoginPage();
    }

    getPath(): string {
        return browser.baseUrl;
    }


}