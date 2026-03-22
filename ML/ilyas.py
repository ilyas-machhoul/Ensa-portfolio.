import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split


import pandas as pd
df = pd.read_csv('Salary_Data.csv')
print(df.head(5))

X = df[['YearsExperience']]
y = df[['Salary']]


X_train, X_test, y_train, y_test = train_test_split(X,y,test_size=0.2, random_state=42 )