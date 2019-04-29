import { browser, protractor } from "protractor";
import { searchPageObject } from '../../pages';

const { When, Then } = require("cucumber");

//const search: SearchPageObject = new SearchPageObject();

When(/^I type "(.*?)"$/, async (text) => {
    await searchPageObject.searchTextBox.sendKeys(text);
});

When(/^I click on search button$/, async () => {
    await browser.actions().sendKeys(protractor.Key.ENTER).perform();
});

Then(/^I click on google logo$/, async () => {
    await searchPageObject.logo.click();
});