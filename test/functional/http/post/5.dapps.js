'use strict';

var test = require('../../functional.js');

var randomstring = require('randomstring');
var lisk = require('lisk-js');
var expect = require('chai').expect;
var Promise = require('bluebird');

var common = require('./common');
var phases = require('../../common/phases');
var accountFixtures = require('../../../fixtures/accounts');

var apiCodes = require('../../../../helpers/apiCodes');
var constants = require('../../../../helpers/constants');

var randomUtil = require('../../../common/utils/random');
var normalizer = require('../../../common/utils/normalizer');
var waitFor = require('../../../common/utils/waitFor');
var apiHelpers = require('../../../common/helpers/api');
var sendTransactionPromise = apiHelpers.sendTransactionPromise;
var errorCodes = require('../../../../helpers/apiCodes');

describe('POST /api/transactions (type 5) register dapp', function () {

	var transaction;
	var transactionsToWaitFor = [];
	var badTransactions = [];
	var goodTransactions = [];

	var account = randomUtil.account();
	var accountNoFunds = randomUtil.account();
	var accountMinimalFunds = randomUtil.account();

	// Variables to check unconfirmed states
	var dappDuplicate = randomUtil.application();
	var dappDuplicateNameSuccess = randomUtil.application();
	var dappDuplicateNameFail = randomUtil.application();
	dappDuplicateNameSuccess.name = dappDuplicateNameFail.name;
	var dappDuplicateLinkSuccess = randomUtil.application();
	var dappDuplicateLinkFail = randomUtil.application();
	dappDuplicateLinkSuccess.link = dappDuplicateLinkFail.link;

	// Crediting accounts
	before(function () {
		var transaction1 = lisk.transaction.createTransaction(account.address, 1000 * normalizer, accountFixtures.genesis.password);
		var transaction2 = lisk.transaction.createTransaction(accountMinimalFunds.address, constants.fees.dappRegistration, accountFixtures.genesis.password);
		var promises = [];
		promises.push(sendTransactionPromise(transaction1));
		promises.push(sendTransactionPromise(transaction2));

		return Promise.all(promises)
			.then(function (results) {
				results.forEach(function (res) {
					expect(res).to.have.property('status').to.equal(200);
					res.body.data.message.should.be.equal('Transaction(s) accepted');
				});

				transactionsToWaitFor.push(transaction1.id, transaction2.id);
				return waitFor.confirmations(transactionsToWaitFor);
			})
			.then(function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.guestbookDapp);

				return sendTransactionPromise(transaction);
			})
			.then(function (res) {
				expect(res).to.have.property('status').to.equal(200);
				res.body.data.message.should.be.equal('Transaction(s) accepted');

				randomUtil.guestbookDapp.id = transaction.id;
				transactionsToWaitFor.push(randomUtil.guestbookDapp.id);
				return waitFor.confirmations(transactionsToWaitFor);
			});
	});

	describe('schema validations', function () {

		common.invalidAssets('dapp', badTransactions);

		describe('category', function () {
			
			it('without should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				delete transaction.asset.dapp.category;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/Missing required property: category$/);
					badTransactions.push(transaction);
				});
			});

			it('with string should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.category = '0';

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.be.equal('Invalid transaction body - Failed to validate dapp schema: Expected type integer but found type string');
					badTransactions.push(transaction);
				});
			});

			it('with integer less than minimum should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.category = -1;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/Value -1 is less than minimum 0$/);
					badTransactions.push(transaction);
				});
			});

			it('with integer greater than maximum should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.category = 9;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/Value 9 is greater than maximum 8$/);
					badTransactions.push(transaction);
				});
			});

			it('with correct integer should be ok', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());

				return sendTransactionPromise(transaction).then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					goodTransactions.push(transaction);
				});
			});
		});

		describe('description', function () {

			it('without should be ok', function () {
				var application = randomUtil.application();
				delete application.description;

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction).then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					goodTransactions.push(transaction);
				});
			});

			it('with integer should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.description = 0;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.be.equal('Invalid transaction body - Failed to validate dapp schema: Expected type string but found type integer');
					badTransactions.push(transaction);
				});
			});

			it('with empty string should be ok', function () {
				var application = randomUtil.application();
				application.description = '';

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction).then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					goodTransactions.push(transaction);
				});
			});

			it('with string longer than maximum(160) should fail', function () {
				var application = randomUtil.application();
				application.description = randomstring.generate({
					length: 161
				});
				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/String is too long \(161 chars\), maximum 160$/);
					badTransactions.push(transaction);
				});
			});
		});

		describe('icon', function () {

			it('without should be ok', function () {
				var application = randomUtil.application();
				delete application.icon;

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction).then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					goodTransactions.push(transaction);
				});
			});

			it('with integer should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.icon = 0;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Invalid transaction body - Failed to validate dapp schema: Expected type string but found type integer');
					badTransactions.push(transaction);
				});
			});

			it('with invalid url should fail', function () {
				var application = randomUtil.application();
				application.icon = 'invalidUrl';

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Invalid application icon link');
					badTransactions.push(transaction);
				});
			});

			it('with invalid file type should fail', function () {
				var application = randomUtil.application();
				application.icon += '.invalid';

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Invalid application icon file type');
					badTransactions.push(transaction);
				});
			});
		});

		describe('link', function () {

			it('with empty string should fail', function () {
				var application = randomUtil.application();
				application.link = '';

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Invalid application link');
					badTransactions.push(transaction);
				});
			});

			it('with integer should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.link = 0;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Invalid transaction body - Failed to validate dapp schema: Expected type string but found type integer');
					badTransactions.push(transaction);
				});
			});


			it('with invalid extension type should fail', function () {
				var application = randomUtil.application();
				application.link += '.invalid';
				
				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Invalid application file type');
					badTransactions.push(transaction);
				});
			});
		});

		describe('name', function () {
			
			it('without should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				delete transaction.asset.dapp.name;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/Missing required property: name$/);
					badTransactions.push(transaction);
				});
			});

			it('with integer should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.name = 0;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Invalid transaction body - Failed to validate dapp schema: Expected type string but found type integer');
					badTransactions.push(transaction);
				});
			});

			it('with empty string should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.name = '';

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/String is too short \(0 chars\), minimum 1$/);
					badTransactions.push(transaction);
				});
			});

			it('with string longer than maximum(32) should fail', function () {
				var application = randomUtil.application();
				application.name = randomstring.generate({
					length: 33
				});
				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/String is too long \(33 chars\), maximum 32$/);
					badTransactions.push(transaction);
				});
			});
		});

		describe('tags', function () {

			it('without should be ok', function () {
				var application = randomUtil.application();
				delete application.tags;

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction).then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					goodTransactions.push(transaction);
				});
			});

			it('with integer should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.tags = 0;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Invalid transaction body - Failed to validate dapp schema: Expected type string but found type integer');
					badTransactions.push(transaction);
				});
			});

			it('with empty string should be ok', function () {
				var application = randomUtil.application();
				application.tags = '';

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction).then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					goodTransactions.push(transaction);
				});
			});

			it('with string longer than maximum(160) should fail', function () {
				var application = randomUtil.application();
				application.tags = randomstring.generate({
					length: 161
				});
				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/String is too long \(161 chars\), maximum 160$/);
					badTransactions.push(transaction);
				});
			});

			it('with several should be ok', function () {
				var application = randomUtil.application();
				application.tags += ',' + randomUtil.applicationName();

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction).then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					goodTransactions.push(transaction);
				});
			});

			it('with duplicate tag should be ok', function () {
				var application = randomUtil.application();
				var tag = application.tags;
				application.tags += ',' + tag;

				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Encountered duplicate tag: ' + tag + ' in application');
					badTransactions.push(transaction);
				});
			});
		});

		describe('type', function () {
			
			it('without should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				delete transaction.asset.dapp.type;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/Missing required property: type$/);
					badTransactions.push(transaction);
				});
			});

			it('with negative integer should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.type = -1;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/Value -1 is less than minimum 0$/);
					badTransactions.push(transaction);
				});
			});

			it('with integer smaller than minimum should fail', function () {
				transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());
				transaction.asset.dapp.type = -1;

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.match(/Value -1 is less than minimum 0$/);
					badTransactions.push(transaction);
				});
			});

			it('with integer greater than maximum should fail', function () {
				var application = randomUtil.application();
				application.type = 2;
				transaction = lisk.dapp.createDapp(account.password, null, application);

				return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
					res.body.message.should.equal('Invalid application type');
					badTransactions.push(transaction);
				});
			});
		});
	});

	describe('transactions processing', function () {

		it('using registered name should fail', function () {
			var dapp = randomUtil.application();
			dapp.name = randomUtil.guestbookDapp.name;
			transaction = lisk.dapp.createDapp(account.password, null, dapp);

			return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
				res.body.message.should.equal('Application name already exists: ' + dapp.name);
				badTransactions.push(transaction);
			});
		});

		it('using registered link should fail', function () {
			var dapp = randomUtil.application();
			dapp.link = randomUtil.guestbookDapp.link;
			transaction = lisk.dapp.createDapp(account.password, null, dapp);

			return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
				res.body.message.should.equal('Application link already exists: ' + dapp.link);
				badTransactions.push(transaction);
			});
		});

		it('with no funds should fail', function () {
			transaction = lisk.dapp.createDapp(accountNoFunds.password, null, randomUtil.application());

			return sendTransactionPromise(transaction, errorCodes.PROCESSING_ERROR).then(function (res) {
				res.body.message.should.equal('Account does not have enough LSK: ' + accountNoFunds.address + ' balance: 0');
				badTransactions.push(transaction);
			});
		});

		it('with minimal funds should be ok', function () {
			transaction = lisk.dapp.createDapp(accountMinimalFunds.password, null, randomUtil.application());

			return sendTransactionPromise(transaction).then(function (res) {
				res.body.data.message.should.be.equal('Transaction(s) accepted');
				goodTransactions.push(transaction);
			});
		});

		it('with valid params should be ok', function () {
			transaction = lisk.dapp.createDapp(account.password, null, randomUtil.application());

			return sendTransactionPromise(transaction).then(function (res) {
				res.body.data.message.should.be.equal('Transaction(s) accepted');
				goodTransactions.push(transaction);
			});
		});
	});

	describe('unconfirmed state', function () {

		it('duplicate submission identical app should be ok and only last transaction to arrive should be confirmed', function () {
			transaction = lisk.dapp.createDapp(account.password, null, dappDuplicate, -1);

			return sendTransactionPromise(transaction)
				.then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					// TODO: Enable when transaction pool order is fixed
					// badTransactions.push(transaction);
				})
				.then(function (res) {
					// Transaction with same info but different ID (due to timeOffSet parameter)
					transaction = lisk.dapp.createDapp(account.password, null, dappDuplicate);

					return sendTransactionPromise(transaction);
				})
				.then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					// TODO: Enable when transaction pool order is fixed
					// goodTransactions.push(transaction);
				});
		});

		it('two different dapps with same name should be ok and only last transaction to arrive should be confirmed', function () {
			transaction = lisk.dapp.createDapp(account.password, null, dappDuplicateNameFail);

			return sendTransactionPromise(transaction)
				.then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					// TODO: Enable when transaction pool order is fixed
					// badTransactions.push(transaction);
				})
				.then(function (res) {
					// Transaction with same info but different ID (due to timeOffSet parameter)
					transaction = lisk.dapp.createDapp(account.password, null, dappDuplicateNameSuccess);

					return sendTransactionPromise(transaction);
				})
				.then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					// TODO: Enable when transaction pool order is fixed
					// goodTransactions.push(transaction);
				});
		});

		it('two different dapps with same link should be ok and only last transaction to arrive should be confirmed', function () {
			transaction = lisk.dapp.createDapp(account.password, null, dappDuplicateLinkFail);

			return sendTransactionPromise(transaction)
				.then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					// TODO: Enable when transaction pool order is fixed
					// badTransactions.push(transaction);
				})
				.then(function (res) {
					// Transaction with same info but different ID (due to timeOffSet parameter)
					transaction = lisk.dapp.createDapp(account.password, null, dappDuplicateLinkSuccess);

					return sendTransactionPromise(transaction);
				})
				.then(function (res) {
					res.body.data.message.should.be.equal('Transaction(s) accepted');
					// TODO: Enable when transaction pool order is fixed
					// goodTransactions.push(transaction);
				});
		});
	});
	
	describe('confirmation', function () {

		phases.confirmation(goodTransactions, badTransactions);
	});
});
