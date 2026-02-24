package demo

type SS struct {
	Name       string
	Age        int
	CreatedAt  string
	IsActive   bool
	Email      string
	Tags       []string
	Profile    Profile
	Addresses  []Address
	Metadata   map[string]string
	Attributes map[string]any
}

type Profile struct {
	Score         float64
	Timezone      string
	Notifications bool
}

type Address struct {
	Type string
	City string
	Zip  string
}
