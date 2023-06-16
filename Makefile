VERSION=$(shell jq -r .version < package.json)

all:
	@echo "Select target"

build:
	npm install
	npm run build

pub:
	rci x eva.ehmi.ec

pkg:
	rm -rf _build
	mkdir -p _build/ec
	cd _build && cp -r ../dist/* ./ec/ && tar czvf ehmi-ec-$(VERSION).tgz ec

pub-pkg:
	gsutil cp -a public-read _build/ehmi-ec-$(VERSION).tgz gs://pub.bma.ai/ehmi/ec/
	rci job run pub.bma.ai
