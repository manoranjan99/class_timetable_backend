from flask import Flask, render_template
import pandas as pd
import sys
import gspread
import logging
from google.oauth2.service_account import Credentials
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import os
from dotenv import load_dotenv

print(sys.executable)

load_dotenv()

import numpy as np

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "fallback_secret_key")


GOOGLE_SHEET_URL='https://docs.google.com/spreadsheets/d/1ohH4NGdRhmoUg4i5BEJ2vTzQ6exQPFRCFN0NmWngISs/edit?usp=sharing'
GOOGLE_SHEET_JSON_KEYFILE_PATH='smooth-aura-427907-f1-ec431d988386.json'
CANCELLED_CELLS = set()

google_sheet_url = GOOGLE_SHEET_URL
json_keyfile_path = GOOGLE_SHEET_JSON_KEYFILE_PATH


def append_in_data_structure(schedule_rows):
    classes_array = []
    MY_SUBJECTS = session.get('my_subjects', [])

    for sheet_row_idx, row_series in schedule_rows:
        row_classes = []
        row = row_series.fillna("").values

        for col_idx, (col_name, subject) in enumerate(zip(row_series.index, row)):
            subject = subject.strip()
            is_cancelled = (sheet_row_idx, col_idx) in CANCELLED_CELLS  
           # print(sheet_row_idx, col_idx, subject, is_cancelled)

            if col_idx < 2:
                row_classes.append({"value": subject, "cancelled": False})
            elif subject in MY_SUBJECTS:
                row_classes.append({"value": subject, "cancelled": is_cancelled})
            else:
                row_classes.append({"value": "--", "cancelled": False})
        
        classes_array.append(row_classes)

    return classes_array

def get_schedule_from_date(schedule_df, date):
    try:
        schedule_df.iloc[:, 0] = schedule_df.iloc[:, 0].astype(str).str.strip()
        mask = schedule_df.iloc[:, 0] == date
        matching_indices = schedule_df.index[mask].tolist()
        result = [(i, schedule_df.loc[i]) for i in matching_indices]
        return result
    except Exception as e:
        logging.error(f"Error: {e}")
        return []


def get_schedule_from_sheet():

    # Setup the Google Sheets API client
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    credentials = Credentials.from_service_account_file(json_keyfile_path, scopes=scope)

    try:
        credentials = Credentials.from_service_account_file(json_keyfile_path, scopes=scope)
        gc = gspread.authorize(credentials)
        logging.info("Successfully authorized with Google Sheets API")
    except Exception as e:
        logging.error(f"Failed to authorize with Google Sheets API: {e}")
        raise

    try:
        sheet = gc.open_by_url(google_sheet_url).sheet1
    except gspread.exceptions.NoValidUrlKeyFound:
        # Extract the key from the URL
        sheet_key = google_sheet_url.split("/d/")[1].split("/")[0]
        sheet = gc.open_by_key(sheet_key).sheet1
    
    # Fetch all values from the sheet
    all_values = sheet.get_all_values()
    schedule_df = pd.DataFrame(all_values)

     # Get the sheet ID from the URL
    sheet_id = google_sheet_url.split("/d/")[1].split("/")[0]
    sheet_name = sheet.title  # Get actual sheet name

    # Setup Google Sheets API client via googleapiclient
    sheets_service = build('sheets', 'v4', credentials=credentials)
    response = sheets_service.spreadsheets().get(
        spreadsheetId=sheet_id,
        ranges=[sheet_name],
        includeGridData=True
    ).execute()

    grid_data = response['sheets'][0]['data'][0]['rowData']
    red_cells = set()

    # Loop over rowData starting from row index 7 (0-indexed) — since actual data starts at row 7 (after 6 header rows)
    for row_idx, row in enumerate(grid_data[7:], start=0):
        for col_idx, cell in enumerate(row.get('values', [])):
            color = cell.get('effectiveFormat', {}).get('backgroundColor', {})
            red = color.get('red', 0)
            green = color.get('green', 0)
            blue = color.get('blue', 0)

            # Consider it "red" if red is dominant and others are low
            if red > 0.9 and green < 0.1 and blue < 0.1:
                red_cells.add((row_idx, col_idx))


    # Store this to use in append_in_data_structure
    global CANCELLED_CELLS
    CANCELLED_CELLS = red_cells


    # Set the new header and drop the row that is now used as header
    schedule_df = schedule_df.iloc[6:].reset_index(drop=True)
    schedule_df.columns = schedule_df.iloc[0]
    schedule_df = schedule_df.drop(0).reset_index(drop=True)

   # Replace blank values with NaN only in merged cells (starting from the third column)
    for row in schedule_df.index:
        for col in range(2, len(schedule_df.columns)):
            if schedule_df.iat[row, col] == '' and schedule_df.iat[row, col-1] != '':
                schedule_df.iat[row, col] = np.nan


    # Replace blank values with NaN starting from the third column
    schedule_df.iloc[:, 2:] = schedule_df.iloc[:, 2:].replace('', np.nan)

    # Forward fill the NaN values starting from the third column
    # schedule_df.iloc[:, 2:] = schedule_df.iloc[:, 2:].ffill(axis=1)

    # Get today's date in the same format as the schedule
    today = datetime.now().strftime("%A, %d %B, %Y").replace(', 0', ', ')

    # Get tomorrow's date in the same format
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%A, %d %B, %Y").replace(', 0', ', ')
    
    # Filter the dataframe
    today_schedule = get_schedule_from_date(schedule_df, today)
    next_day_schedule = get_schedule_from_date(schedule_df, tomorrow)

    today_class = append_in_data_structure(today_schedule)
    next_day_class = append_in_data_structure(next_day_schedule)

    return today,tomorrow,today_class,next_day_class


@app.route('/')
def index():
    # Check if user is logged in (via cookie)
    user_email = request.cookies.get('user_email')
    if not user_email:
        return redirect('/login')  # Redirect to login if not logged in

    # If logged in, fetch the schedule
    today, tomorrow, today_schedule, tomorrow_schedule = get_schedule_from_sheet()
    return render_template(
        'index.html',
        user_email=user_email,
        today=today,
        tomorrow=tomorrow,
        schedule=today_schedule,
        tomorrow_schedule=tomorrow_schedule
    )


@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/set_subjects', methods=['POST'])
def set_subjects():
    data = request.get_json()
    session['my_subjects'] = data.get('subjects', [])
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(debug=True)


