# Sakshi Computer — Banking Manager

A private web application for managing customer records and preparing bank account-opening forms at Sakshi Computer.

## Features

- Owner login
- Manual customer data entry
- Save, search and edit customer records
- Submit applications with available details
- Add account numbers later and mark accounts as opened
- Preview, download and print two-page bank application PDFs
- Blank spaces for physical photos and signatures

## Tech Stack

React · Vite · CSS · Node.js · Express · SQLite

## Workflow

Enter details → Save / Submit → Print form → Add account number → Mark as opened

“Submitted” is an internal tracking status; the app does not send applications to the bank.

## Local Setup

Install dependencies:

npm install

Start the frontend:

npm run dev

Configure the backend using `.env.example` and the available package scripts.

## Data Privacy

Customer databases, backups, credentials and filled forms must not be committed to Git.

## Project Status

Local development. Deployment planned.

Built by Palak Jain.
