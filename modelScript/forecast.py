import sys
import json
import joblib
import pandas as pd
# from skforecast.utils import load_forecasters

def forecast(data, model_path, n_steps=1):
    # Load the model
    model = joblib.load(model_path)

    # Create DataFrame with the input data
    X = pd.DataFrame(data)
    X.set_index(X.index+34280, inplace=True);

    # Make predictions
    forecasted_values = model.predict(steps=n_steps, exog=X[["KPI_Value_1", "KPI_Value_2", "KPI_Value_3", "KPI_Value_4", "KPI_Value_5"]])

    return forecasted_values

def main():
    # Read input data from command line
    input_data = json.loads(sys.argv[1])
    model_path = 'models/Stamping Press Efficiency_forecaster.joblib'

    # Make predictions
    forecasted_point1 = forecast(input_data, model_path)

    # Prepare the result
    result = {
        'forecasted_point1': float(forecasted_point1)
    }

    # Print the result as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()