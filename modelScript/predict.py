import sys
import json
import joblib
import pandas as pd

def detect_anomaly(data, model_path):
    # Load the model
    model = joblib.load(model_path)

    # Create DataFrame with the input data
    X = pd.DataFrame(data)

    # Make predictions
    y_pred = model.predict(X[["KPI_Value", "Lag1", "Lag2", "Lag3", "Lag4", "Lag5"]])

    return y_pred[0]

def main():
    # Read input data from command line
    input_data = json.loads(sys.argv[1])
    model_path = 'models/model_CNC Machine Utilization_f1_1.0.joblib'

    # Make predictions
    anomaly = detect_anomaly(input_data, model_path)

    # # Prepare the result
    # result = {
    #     'anomaly': bool(anomaly),
    #     'forecasted_point1': input_data['KPI_Value'][0] + 10,  # Placeholder for forecasted point 1
    #     'forecasted_point2': input_data['KPI_Value'][0] + 20,  # Placeholder for forecasted point 2
    #     'trend': 'up' if input_data['KPI_Value'][0] + 20 > input_data['KPI_Value'][0] + 10 else 'down'
    # }

    # Print the result as JSON
    print(anomaly)

if __name__ == "__main__":
    main()