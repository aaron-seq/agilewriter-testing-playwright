class OccurrenceGenerator:
    def __init__(self):
        self.counter = 0

    def next_id(self):
        self.counter += 1
        return f"PH_{self.counter:04d}"